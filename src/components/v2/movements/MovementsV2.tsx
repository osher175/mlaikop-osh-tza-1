import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, ClipboardList, Coins, Download, MoreHorizontal, Package, RotateCcw, SlidersHorizontal, Truck, Wallet, Wrench,
} from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { useCostVisibility } from '@/hooks/useCostVisibility';
import { useUserRole } from '@/hooks/useUserRole';
import { useEmployees } from '@/hooks/v2/useEmployees';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useToast } from '@/hooks/use-toast';
import { useJournalSuppliers, useMovementJournal, type JournalFilters } from '@/hooks/v2/useMovementJournal';
import { CUSTOMER_RETURN_READY, recordCustomerReturn, SUPPLIER_RETURN_READY, recordSupplierReturn } from '@/lib/v2/inventoryLifecycle';
import { partialReturnQuantityValid, supplierReturnQuantityValid } from '@/lib/v2/quantityRules';
import { defaultRange, isValidDay, VAT_RATE, type DayRange } from '@/lib/v2/dashboardMetrics';
import {
  classifyJournal, isLegacySale, isPurchaseReceipt, isQuickSaleStockMove, kindLabel, knownUnitCost, movementBalance, movementEmployeeId, movementTotal, movementUnitPrice, type JournalAction, type JournalKind,
} from '@/lib/v2/movementJournal';
import { SearchInput, v2Button } from '@/components/v2/Controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Bidi, CurrencyValue } from '@/components/v2/Display';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/v2/States';

const KINDS: { id: JournalKind; label: string }[] = [
  { id: 'all', label: 'כל הסוגים' },
  { id: 'sale', label: 'מכירות' },
  { id: 'purchase', label: 'קליטות רכש' },
  { id: 'adjustment', label: 'התאמות מלאי' },
  { id: 'supplier_return', label: 'החזרות לספק' },
  { id: 'customer_return', label: 'החזרות לקוח' },
  { id: 'reversal', label: 'ביטולי תנועה' },
  { id: 'other', label: 'אחר' },
];

const isKind = (value: string | null): value is JournalKind => KINDS.some((kind) => kind.id === value);
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
const when = (value: string | null) => value ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(value)) : 'בלי חותמת זמן';
const field = 'mt-1 h-12 w-full rounded-2xl border border-[#e2e8f0] bg-white px-3 text-sm font-semibold text-[#1e293b]';
const primaryButton = 'inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-l from-[#1ed4a8] to-[#0ea5a0] px-5 text-base font-extrabold text-white shadow-[0_8px_18px_rgba(14,165,160,0.28)]';
const secondaryButton = 'inline-flex h-12 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 text-[15px] font-bold text-[#1e293b] shadow-[0_4px_12px_rgba(15,23,42,0.05)] disabled:cursor-not-allowed disabled:opacity-50';

const readRange = (params: URLSearchParams): DayRange => {
  const from = params.get('from');
  const to = params.get('to');
  if (isValidDay(from) && isValidDay(to) && from <= to) return { from, to };
  return defaultRange();
};

export const MovementsV2: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { permissions } = useUserRole();
  const { hidden: costHidden } = useCostVisibility();
  const canFinance = !!permissions.canViewReports;
  const canAdjust = !!permissions.canEditProducts;
  const { activeBusinessId } = useActiveBusiness();
  const employees = useEmployees();
  const suppliers = useJournalSuppliers();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const range = readRange(params);
  const kind: JournalKind = isKind(params.get('type')) ? params.get('type') as JournalKind : 'all';
  const supplierId = params.get('supplier');
  const employeeId = params.get('employee') ?? 'all';
  const search = params.get('q') ?? '';
  const pageNumber = Math.max(1, Number(params.get('page')) || 1);
  const debounced = useDebounce(search, 300);
  const filters = useMemo<JournalFilters>(() => ({
    range, kind, supplierId, employeeId, search: debounced, page: pageNumber,
  }), [range, kind, supplierId, employeeId, debounced, pageNumber]);
  const journal = useMovementJournal(filters);
  const rows = journal.page.data?.rows ?? [];
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const names = journal.page.data?.names;

  const update = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  const exportPage = () => {
    const header = ['מועד', 'סוג', 'מוצר', 'שינוי כמות', 'מחיר יחידה', 'עלות יחידה', 'סכום', 'ספק', 'עובד', 'אסמכתא'];
    const lines = rows.map((row) => [
      when(row.timestamp),
      kindLabel(classifyJournal(row)),
      names?.products.get(row.product_id) ?? row.product_id,
      String(row.quantity_changed),
      moneyText(movementUnitPrice(row), canFinance),
      moneyText(knownUnitCost(row), canFinance && !costHidden),
      moneyText(movementTotal(row), canFinance),
      party(row, names),
      employeeName(row, names),
      row.reference_id ?? '',
    ]);
    const csv = `\uFEFF${[header, ...lines].map((line) => line.map(csvCell).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-movements-page-${pageNumber}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const total = journal.page.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / journal.pageSize));
  const money = journal.money.data;
  const salesInView = filters.kind === 'all' || filters.kind === 'sale';
  const saleRows = salesInView ? (journal.money.isLoading ? -1 : money?.saleRows ?? 0) : 0;

  return (
    <div dir="rtl" className="font-[Heebo] text-v2-text min-w-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[#e7f1ff] text-[#2f6fe0]" aria-hidden>
            <Package className="h-8 w-8" strokeWidth={1.6} />
          </span>
          <div>
            <h1 className="text-[28px] font-extrabold leading-none text-[#1e293b] md:text-[34px]">יומן תנועות מלאי</h1>
            <p className="mt-2 text-sm text-[#64748b]">מכירות, קליטות, החזרות ותיקוני מלאי שנשמרו לעסק. אין כאן סניפים, ואין כפילות של אותה תנועה.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAdjust && <Link to="/inventory" className={primaryButton}><Wrench className="h-4 w-4" aria-hidden />תיקון מלאי</Link>}
          <button type="button" className={secondaryButton} onClick={exportPage} disabled={rows.length === 0} title="מייצא את העמוד המוצג בלבד"><Download className="h-4 w-4" aria-hidden />ייצוא לאקסל</button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white text-[#1e293b] shadow-[0_4px_12px_rgba(15,23,42,0.05)]" aria-label="פעולות נוספות">
              <MoreHorizontal className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onClick={() => navigate('/procurement/returns')}>החזרות לספקים</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Kpi label="תיקוני מלאי" value={countText(journal.counts.data?.searchIncomplete, journal.counts.isLoading, journal.counts.data?.adjustments)} unit="תנועות" icon={Wrench} tone="border-[#dce8fb] bg-[#f5f9ff] text-[#2f6fe0]" />
        <Kpi label="סה״כ תנועות" value={countText(journal.counts.data?.searchIncomplete, journal.counts.isLoading, journal.counts.data?.total)} unit="תנועות" icon={ArrowLeftRight} tone="border-[#d9f5e4] bg-[#f4fbf7] text-[#1a9a52]" />
        <Kpi label="החזרות לספקים" value={countText(journal.counts.data?.searchIncomplete, journal.counts.isLoading, journal.counts.data?.supplierReturns)} unit="תנועות" icon={RotateCcw} tone="border-[#fde8d2] bg-[#fffaf5] text-[#e08a2a]" note="נספרות רק החזרות שנשמרו כהחזרה לספק. החזרות ישנות לא שוחזרו." />
        <Kpi label="קליטות רכש" value={countText(journal.counts.data?.searchIncomplete, journal.counts.isLoading, journal.counts.data?.purchases)} unit="תנועות" icon={Truck} tone="border-[#eadfff] bg-[#faf7ff] text-[#7c4dff]" />
        <Kpi label="מחזור מכירות" value={revenueText(canFinance, journal.money.isLoading, money, saleRows)} unit="כולל מע״מ" icon={Wallet} tone="border-[#dce8fb] bg-[#f5f9ff] text-[#2f6fe0]" note="שורת מלאי של מכירה מהירה בלי סכום לא נספרת שוב." />
        <Kpi label="רווח גולמי ממכירות" value={profitText(canFinance, costHidden, journal.money.isLoading, money, saleRows)} unit="לפני מע״מ" icon={Coins} tone="border-[#d7f3ec] bg-[#f4fcf9] text-[#12a394]" note="רק שורות מכירה עם עלות ידועה. תיקון, קליטה והחזרה לספק אינם נכנסים." />
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={(event) => event.preventDefault()}>
        <label className="text-xs font-bold text-[#64748b]">מתאריך
          <input type="date" aria-label="מתאריך" className={field} value={range.from} onChange={(event) => update({ from: event.target.value })} />
        </label>
        <label className="text-xs font-bold text-[#64748b]">עד
          <input type="date" aria-label="עד תאריך" className={field} value={range.to} onChange={(event) => update({ to: event.target.value })} />
        </label>
        <label className="min-w-[9rem] text-xs font-bold text-[#64748b]">סוג תנועה
          <select aria-label="סוג תנועה" className={field} value={kind} onChange={(event) => update({ type: event.target.value === 'all' ? null : event.target.value })}>
            {KINDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="min-w-[9rem] text-xs font-bold text-[#64748b]">ספק
          <select aria-label="ספק" className={field} value={supplierId ?? ''} onChange={(event) => update({ supplier: event.target.value || null })}>
            <option value="">כל הספקים</option>
            {(suppliers.data?.suppliers ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label className="min-w-[9rem] text-xs font-bold text-[#64748b]">לקוח
          <select aria-label="לקוח" className={field} disabled value="">
            <option value="">לא נשמר בתנועה</option>
          </select>
        </label>
        <label className="min-w-[9rem] text-xs font-bold text-[#64748b]">עובד
          <select aria-label="עובד" className={field} value={employeeId} onChange={(event) => update({ employee: event.target.value === 'all' ? null : event.target.value })}>
            <option value="all">כל העובדים</option>
            <option value="unattributed">ללא שיוך</option>
            {employees.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.display_name}{employee.is_active ? '' : ' (לא פעיל)'}</option>)}
          </select>
        </label>
        <SearchInput className="min-w-[16rem] flex-1" value={search} onChange={(value) => update({ q: value || null })} label="חיפוש מוצר, מסמך או הערה" placeholder="שם מוצר, ברקוד, הערה או מזהה מסמך" />
        <button type="button" className={secondaryButton} onClick={() => setParams({}, { replace: true })}><SlidersHorizontal className="h-4 w-4" aria-hidden />איפוס סינון</button>
      </form>
      <p className="text-xs text-v2-muted mb-3">תנועה בלי חותמת זמן לא נכנסת לטווח. יתרה מוצגת רק כשהתנועה שמרה מלאי לפני ואחרי. בשאר השורות היא לא זמינה.{suppliers.data?.incomplete ? ' רשימת הספקים ארוכה מהעמוד שנטען.' : ''}</p>

      {journal.page.isLoading || journal.businessLoading ? <LoadingSkeleton variant="panel" /> : journal.page.isError ? <ErrorState onRetry={() => { void journal.page.refetch(); }} /> : journal.page.data?.searchIncomplete ? (
        <EmptyState title="החיפוש רחב מדי" description="יש יותר מדי מוצרים תואמים, ולכן הרשימה לא הוצגה חלקית. יש לדייק את השם או הברקוד." />
      ) : rows.length === 0 ? (
        <EmptyState title="אין תנועות בסינון" description="היומן קורא את התנועות שנשמרו. לא נוצרו כאן תנועות לדוגמה." />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="order-2 xl:order-1">
            {selected ? <Detail row={selected} names={names} canFinance={canFinance} costHidden={costHidden} canRecord={canAdjust} businessId={activeBusinessId} /> : (
              <section className="rounded-[22px] border border-[#e6eef6] bg-white p-4 text-sm text-[#64748b] shadow-[0_10px_30px_rgba(15,23,42,0.05)]">בחרו תנועה כדי לראות את הרשומה השמורה. לא מחוברות כאן תנועות שונות לעסקה אחת.</section>
            )}
          </div>
          <div className="order-1 min-w-0 xl:order-2">
            <div className="space-y-2 md:hidden">
              {rows.map((row) => <MovementCard key={row.id} row={row} names={names} selected={selectedId === row.id} canFinance={canFinance} costHidden={costHidden} onSelect={() => setSelectedId(row.id)} />)}
            </div>
            <div className="hidden overflow-x-auto rounded-[22px] border border-[#e6eef6] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] md:block">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="bg-[#f6f8fb] text-[#7b8798]">
                  <tr>{['מועד', 'סוג', 'מוצר', 'כמות', 'לפני', 'אחרי', 'מחיר מכירה', 'עלות', 'סכום', 'ספק או לקוח', 'עובד', 'אסמכתא', 'פירוט'].map((heading) => <th key={heading} className="px-3 py-3 text-right font-semibold">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const kindName = classifyJournal(row);
                    const balance = movementBalance(row);
                    return (
                      <tr key={row.id} className={cn('border-t border-[#eef3f8]', selectedId === row.id ? 'bg-[#e7f8f4]' : 'hover:bg-[#f8fbfa]')}>
                        <td className="whitespace-nowrap px-3 py-2">{when(row.timestamp)}</td>
                        <td className="px-3 py-2"><KindBadge kind={kindName} /></td>
                        <td className="px-3 py-2 font-semibold">{names?.products.get(row.product_id) ?? 'מוצר לא זמין'}</td>
                        <td className="px-3 py-2 font-extrabold"><QuantityChange value={row.quantity_changed} /></td>
                        <td className="px-3 py-2 text-[#64748b]">{balance.before ?? 'לא זמין'}</td>
                        <td className="px-3 py-2 text-[#64748b]">{balance.after ?? 'לא זמין'}</td>
                        <td className="px-3 py-2">{canFinance ? <CurrencyValue value={movementUnitPrice(row)} /> : 'אין הרשאה'}</td>
                        <td className="px-3 py-2">{canFinance && !costHidden ? <CurrencyValue value={knownUnitCost(row)} /> : canFinance ? 'מוסתר' : 'אין הרשאה'}</td>
                        <td className="px-3 py-2">{canFinance ? <CurrencyValue value={movementTotal(row)} /> : 'אין הרשאה'}</td>
                        <td className="px-3 py-2">{party(row, names)}</td>
                        <td className="px-3 py-2">{employeeName(row, names)}</td>
                        <td className="px-3 py-2">{row.reference_id ? <Bidi>{row.reference_id.slice(0, 8)}</Bidi> : 'אין מסמך'}</td>
                        <td className="px-3 py-2">
                          <button type="button" className="inline-flex h-8 items-center gap-1 rounded-full border border-[#d7dee7] bg-white px-3 text-xs font-bold text-[#1e293b]" onClick={() => setSelectedId(row.id)}><ClipboardList className="h-3.5 w-3.5" aria-hidden />פירוט</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[#64748b]">מציג {(pageNumber - 1) * journal.pageSize + 1}–{Math.min(pageNumber * journal.pageSize, total)} מתוך {total}</p>
              <div className="flex flex-wrap gap-1">
                <button type="button" className={secondaryButton} disabled={pageNumber <= 1} onClick={() => update({ page: String(pageNumber - 1) }, false)}>הקודם</button>
                {pageWindow(pageNumber, pages).map((item) => (
                  <button key={item} type="button" aria-current={item === pageNumber ? 'page' : undefined} className={cn('h-12 min-w-12 rounded-2xl px-3 text-sm font-bold', item === pageNumber ? 'bg-gradient-to-l from-[#1ed4a8] to-[#0ea5a0] text-white' : 'border border-[#e2e8f0] bg-white text-[#1e293b]')} onClick={() => update({ page: String(item) }, false)}>{item}</button>
                ))}
                <button type="button" className={secondaryButton} disabled={pageNumber >= pages} onClick={() => update({ page: String(pageNumber + 1) }, false)}>הבא</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const pageWindow = (page: number, pages: number) => {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  return Array.from({ length: Math.min(5, pages) }, (_, index) => start + index).filter((item) => item >= 1 && item <= pages);
};

const countText = (incomplete: boolean | undefined, loading: boolean, value: number | undefined) => {
  if (incomplete) return 'חלקי';
  if (loading || value === undefined) return '…';
  return String(value);
};

const Kpi: React.FC<{ label: string; value: string; unit: string; note?: string; icon: typeof Package; tone: string }> = ({ label, value, unit, note, icon: Icon, tone }) => (
  <article className={cn('flex min-h-[108px] min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]', tone)}>
    <Icon className="h-8 w-8 shrink-0" strokeWidth={1.75} aria-hidden />
    <div className="min-w-0">
      <p className="text-[13px] font-semibold">{label}</p>
      <p className="text-[26px] font-extrabold leading-tight break-words">{value}</p>
      <p className="text-[11px] font-semibold opacity-80">{unit}</p>
      {note && <p className="mt-1 text-[11px] leading-snug opacity-80">{note}</p>}
    </div>
  </article>
);

const party = (row: JournalAction, names?: JournalPageNames) => row.supplier_id ? (names?.suppliers.get(row.supplier_id) ?? 'ספק לא זמין') : 'לקוח לא נשמר';
const employeeName = (row: JournalAction, names?: JournalPageNames) => {
  const employeeId = movementEmployeeId(row);
  if (!employeeId) return 'ללא שיוך';
  return names?.employees.get(employeeId) ?? 'שם לא זמין';
};

type JournalPageNames = { products: Map<string, string>; suppliers: Map<string, string>; employees: Map<string, string> };

const moneyText = (value: number | null, allowed: boolean) => {
  if (!allowed) return 'אין הרשאה';
  return value === null ? 'לא ידוע' : String(value);
};

const revenueText = (allowed: boolean, loading: boolean, money: { truncated: boolean; summary: { revenueGross: number } } | undefined, saleRows: number) => {
  if (!allowed) return 'אין הרשאה';
  if (saleRows === 0) return '₪0';
  if (loading || !money) return '…';
  if (money.truncated) return 'חלקי';
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(money.summary.revenueGross);
};

const profitText = (allowed: boolean, costHidden: boolean, loading: boolean, money: { truncated: boolean; summary: { grossProfit: number | null } } | undefined, saleRows: number) => {
  if (!allowed) return 'אין הרשאה';
  if (costHidden) return 'מוסתר';
  if (saleRows === 0) return 'אין מכירות בסינון';
  if (loading || !money) return '…';
  if (money.truncated) return 'חלקי';
  if (money.summary.grossProfit === null) return 'לא ידוע';
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(money.summary.grossProfit);
};

const KIND_TONE: Record<Exclude<JournalKind, 'all'>, string> = {
  sale: 'bg-[#e8f2ff] text-[#1d6fe0]',
  purchase: 'bg-[#f4ecff] text-[#7c3aed]',
  supplier_return: 'bg-[#fff4e8] text-[#e07a12]',
  adjustment: 'bg-[#eef2f6] text-[#526174]',
  customer_return: 'bg-[#e7f8ef] text-[#128a45]',
  reversal: 'bg-[#f4f6f8] text-[#8b97a6]',
  other: 'bg-[#f4f6f8] text-[#526174]',
};

const KindBadge: React.FC<{ kind: Exclude<JournalKind, 'all'> }> = ({ kind }) => (
  <span className={cn('inline-flex h-7 items-center rounded-full px-2.5 text-xs font-bold', KIND_TONE[kind])}>{kindLabel(kind)}</span>
);

const QuantityChange: React.FC<{ value: number }> = ({ value }) => (
  <span className={value > 0 ? 'text-[#14944a]' : value < 0 ? 'text-[#1e293b]' : 'text-[#64748b]'}>
    <span className="sr-only">{value > 0 ? 'כניסה' : value < 0 ? 'יציאה' : 'ללא שינוי'}</span>
    <Bidi>{value > 0 ? `+${value}` : String(value)}</Bidi>
  </span>
);

const lineSaleProfit = (row: JournalAction) => {
  if (!isLegacySale(row) || row.sale_total_ils === null) return null;
  const cost = knownUnitCost(row);
  if (cost === null) return { profit: null as number | null, margin: null as number | null };
  const net = row.sale_total_ils / (1 + VAT_RATE);
  const profit = net - cost * Math.abs(row.quantity_changed);
  return { profit, margin: net > 0 ? profit / net : null };
};

const MovementCard: React.FC<{
  row: JournalAction; names?: JournalPageNames; selected: boolean; canFinance: boolean; costHidden: boolean; onSelect: () => void;
}> = ({ row, names, selected, canFinance, costHidden, onSelect }) => (
  <button type="button" onClick={onSelect} className={cn('w-full rounded-2xl border p-3 text-right', selected ? 'border-[#12b981] bg-[#e7f8f4]' : 'border-[#e6eef6] bg-white')}>
    <span className="flex items-center justify-between gap-2 text-sm"><KindBadge kind={classifyJournal(row)} /><span>{when(row.timestamp)}</span></span>
    <span className="mt-1 block font-semibold">{names?.products.get(row.product_id) ?? 'מוצר לא זמין'}</span>
    <span className="mt-1 block text-sm text-[#64748b]">כמות <QuantityChange value={row.quantity_changed} /> · {employeeName(row, names)}</span>
    <span className="mt-1 block text-sm">{canFinance ? <CurrencyValue value={movementTotal(row)} /> : 'אין הרשאה פיננסית'}{canFinance && !costHidden ? <> · עלות <CurrencyValue value={knownUnitCost(row)} /></> : null}</span>
  </button>
);

const Detail: React.FC<{ row: JournalAction; names?: JournalPageNames; canFinance: boolean; costHidden: boolean; canRecord: boolean; businessId: string | null }> = ({ row, names, canFinance, costHidden, canRecord, businessId }) => {
  const profit = canFinance && !costHidden ? lineSaleProfit(row) : null;
  const balance = movementBalance(row);
  return (
  <section className="rounded-[22px] border border-[#e6eef6] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
    <div className="mb-3 flex items-start justify-between gap-2">
      <div>
        <p className="text-xs text-[#64748b]">{row.reference_id ? <Bidi>{row.reference_id.slice(0, 8)}</Bidi> : 'אין מסמך שמור'}</p>
        <h2 className="text-lg font-extrabold">{names?.products.get(row.product_id) ?? 'מוצר לא זמין'}</h2>
      </div>
      <KindBadge kind={classifyJournal(row)} />
    </div>
    <dl className="grid gap-2 sm:grid-cols-2 text-sm">
      <Item label="סוג" value={kindLabel(classifyJournal(row))} />
      <Item label="מועד" value={when(row.timestamp)} />
      <Item label="מוצר" value={names?.products.get(row.product_id) ?? 'מוצר לא זמין'} />
      <Item label="שינוי כמות" value={String(row.quantity_changed)} />
      <Item label="מלאי לפני" value={balance.before === null ? 'לא זמין' : String(balance.before)} />
      <Item label="מלאי אחרי" value={balance.after === null ? 'לא זמין' : String(balance.after)} />
      <Item label="מחיר יחידה" value={canFinance ? (movementUnitPrice(row) === null ? 'לא ידוע' : String(movementUnitPrice(row))) : 'אין הרשאה'} />
      <Item label="עלות יחידה" value={!canFinance ? 'אין הרשאה' : costHidden ? 'מוסתר' : knownUnitCost(row) === null ? 'לא ידוע' : String(knownUnitCost(row))} />
      <Item label="סכום" value={canFinance ? (movementTotal(row) === null ? 'לא ידוע' : String(movementTotal(row))) : 'אין הרשאה'} />
      <Item label="ספק או לקוח" value={party(row, names)} />
      <Item label="עובד משויך" value={employeeName(row, names)} />
      <Item label="אסמכתא" value={row.reference_id ? `${row.reference_type ?? 'מסמך'} ${row.reference_id}` : 'אין מסמך שמור'} />
      <Item label="סטטוס" value={row.reversed_at ? 'התנועה בוטלה' : row.is_reversal ? 'זו תנועת ביטול' : 'פעילה'} />
      <Item label="מבטל את" value={row.reverses_action_id ?? 'לא רלוונטי'} />
      <Item label="הערה" value={row.notes ?? 'אין הערה'} />
      <Item label="מקור" value={row.source ?? row.action_type} />
    </dl>
    {profit && (
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <p className="rounded-2xl bg-[#f4fcf9] p-3"><span className="block text-xs text-[#64748b]">רווח גולמי לפני מע״מ</span><b>{profit.profit === null ? 'לא ידוע' : <CurrencyValue value={profit.profit} />}</b></p>
        <p className="rounded-2xl bg-[#f4fbf7] p-3"><span className="block text-xs text-[#64748b]">שיעור רווח על העלות הידועה</span><b>{profit.margin === null ? 'לא ידוע' : `${Math.round(profit.margin * 1000) / 10}%`}</b></p>
      </div>
    )}
    <p className="text-xs text-v2-muted mt-3">המשתמש שרשם את התנועה אינו איש המכירות. במכירה מהירה העובד והסכום נקראים מהעסקה ומשורת המכירה שלה. תנועה בלי עובד שמור נשארת ללא שיוך. הרשומה הזו לא ניתנת לעריכה מכאן.</p>
    {canRecord && businessId && (isLegacySale(row) || isQuickSaleStockMove(row)) && !row.reversed_at && (
      <CustomerReturnForm row={row} businessId={businessId} />
    )}
    {canRecord && businessId && isPurchaseReceipt(row) && (
      <SupplierReturnForm row={row} businessId={businessId} supplierName={row.supplier_id ? (names?.suppliers.get(row.supplier_id) ?? 'ספק לא זמין') : 'אין ספק בתנועה'} />
    )}
  </section>
  );
};

const CustomerReturnForm: React.FC<{ row: JournalAction; businessId: string }> = ({ row, businessId }) => {
  const { toast } = useToast();
  const [quantity, setQuantity] = React.useState('1');
  const [disposition, setDisposition] = React.useState<'restock' | 'damaged'>('restock');
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const requestKey = React.useRef<{ signature: string; key: string } | null>(null);
  const sold = Math.abs(row.quantity_changed);
  const units = Number(quantity);
  const quantityValid = partialReturnQuantityValid(units, sold);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!CUSTOMER_RETURN_READY || pending) return;
    if (!quantityValid) return;
    const signature = JSON.stringify({ id: row.id, units, disposition, notes });
    const request = requestKey.current?.signature === signature ? requestKey.current : { signature, key: crypto.randomUUID() };
    requestKey.current = request;
    setPending(true);
    try {
      await recordCustomerReturn({
        businessId,
        originalActionId: row.id,
        quantity: units,
        idempotencyKey: request.key,
        disposition,
        notes,
      });
      requestKey.current = null;
      toast({ title: 'החזרת הלקוח נרשמה', description: 'לא נרשם החזר כספי.' });
    } catch (error) {
      toast({ title: 'ההחזרה לא נרשמה', description: error instanceof Error ? error.message : 'המלאי לא שונה.', variant: 'destructive' });
    } finally {
      setPending(false);
    }
  };
  return (
    <form className="mt-4 grid gap-2 border-t border-v2-border pt-3" onSubmit={submit}>
      <p className="font-bold">החזרת לקוח חלקית</p>
      <p className="text-xs text-v2-muted">נמכרו {sold} יחידות. החזרה למלאי או רישום בלי החזרה למלאי. אין כאן החזר כספי, ואין ביטול של כל המכירה.</p>
      <label className="text-sm">כמות
        <input className="mt-1 h-11 w-full rounded-v2-control border border-v2-border px-2" type="number" min={1} max={sold} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </label>
      <label className="text-sm">מצב הסחורה
        <select className="mt-1 h-11 w-full rounded-v2-control border border-v2-border px-2" value={disposition} onChange={(event) => setDisposition(event.target.value === 'damaged' ? 'damaged' : 'restock')}>
          <option value="restock">חזרה למלאי</option>
          <option value="damaged">פגומה, בלי החזרה למלאי</option>
        </select>
      </label>
      <label className="text-sm">הערה
        <input className="mt-1 h-11 w-full rounded-v2-control border border-v2-border px-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <button type="submit" className={v2Button.secondary} disabled={!CUSTOMER_RETURN_READY || pending || !quantityValid}>רישום החזרה</button>
      {!quantityValid && <p className="text-xs text-v2-muted">הכמות צריכה להיות מספר שלם בין 1 ל-{sold}.</p>}
      {!CUSTOMER_RETURN_READY && <p className="text-xs text-v2-muted">החזרת הלקוח עדיין כבויה. המלאי לא ישתנה.</p>}
    </form>
  );
};

const SupplierReturnForm: React.FC<{ row: JournalAction; businessId: string; supplierName: string }> = ({ row, businessId, supplierName }) => {
  const { toast } = useToast();
  const [quantity, setQuantity] = React.useState('1');
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const requestKey = React.useRef<{ signature: string; key: string } | null>(null);
  const units = Number(quantity);
  const quantityValid = supplierReturnQuantityValid(units);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!SUPPLIER_RETURN_READY || pending || !row.supplier_id || !quantityValid || !reason.trim()) return;
    const signature = JSON.stringify({ id: row.id, units, reason: reason.trim() });
    const request = requestKey.current?.signature === signature ? requestKey.current : { signature, key: crypto.randomUUID() };
    requestKey.current = request;
    setPending(true);
    try {
      await recordSupplierReturn({
        businessId,
        productId: row.product_id,
        supplierId: row.supplier_id,
        quantity: units,
        idempotencyKey: request.key,
        reason: reason.trim(),
      });
      requestKey.current = null;
      toast({ title: 'החזרה לספק נרשמה', description: 'לא נרשם זיכוי כספי.' });
    } catch (error) {
      toast({ title: 'ההחזרה לא נרשמה', description: error instanceof Error ? error.message : 'המלאי לא שונה.', variant: 'destructive' });
    } finally {
      setPending(false);
    }
  };
  return (
    <form className="mt-4 grid gap-2 border-t border-v2-border pt-3" onSubmit={submit}>
      <p className="font-bold">החזרה לספק</p>
      <p className="text-xs text-v2-muted">ספק: {supplierName}. הרישום מוריד מלאי בלבד, בלי זיכוי כספי.</p>
      <label className="text-sm">כמות
        <input className="mt-1 h-11 w-full rounded-v2-control border border-v2-border px-2" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </label>
      <label className="text-sm">סיבה
        <input className="mt-1 h-11 w-full rounded-v2-control border border-v2-border px-2" value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <button type="submit" className={v2Button.secondary} disabled={!SUPPLIER_RETURN_READY || pending || !row.supplier_id || !reason.trim() || !quantityValid}>רישום החזרה</button>
      {!quantityValid && <p className="text-xs text-v2-muted">הכמות צריכה להיות מספר שלם של 1 לפחות.</p>}
      {!SUPPLIER_RETURN_READY && <p className="text-xs text-v2-muted">החזרה לספק עדיין כבויה. המלאי לא ישתנה.</p>}
    </form>
  );
};

const Item: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-v2-muted">{label}</dt>
    <dd className="font-semibold break-words">{value}</dd>
  </div>
);
