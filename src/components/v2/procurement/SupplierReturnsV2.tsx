import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, CalendarDays, CheckCircle2, ChevronDown, Clock, Coins, MoreHorizontal, Package, Plus, Search, Trash2, Truck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchBusinessSuppliers } from '@/hooks/useSuppliers';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { Bidi } from '@/components/v2';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { lineTotal, moneyInputValid } from '@/lib/v2/purchaseOrder';
import { SUPPLIER_RETURN_DISPATCH_READY } from '@/lib/v2/inventoryFlags';
import { confirmSupplierReturnDispatch } from '@/lib/v2/inventoryLifecycle';
import {
  CREDIT_NOT_A_STOCK_EXIT,
  DISPATCH_CLOSED,
  DISPATCH_CONFIRMATION,
  LEDGER_UNAVAILABLE,
  RETURN_REASONS,
  returnDraftIssues,
  returnDraftTotal,
  supplierReturnCanonical,
  type ReturnDraftLine,
  type ReturnReasonId,
} from '@/lib/v2/supplierReturnDraft';

const KPIS: { label: string; icon: typeof Package; tone: string }[] = [
  { label: 'מסירות שאושרו', icon: Truck, tone: 'border-[#dce8fb] bg-[#f5f9ff] text-[#2f6fe0]' },
  { label: 'יחידות שיצאו', icon: Package, tone: 'border-[#fde8d2] bg-[#fffaf5] text-[#e08a2a]' },
  { label: 'שווי החזרות', icon: Coins, tone: 'border-[#d7f3ec] bg-[#f4fcf9] text-[#12a394]' },
  { label: 'זיכויים שנרשמו', icon: Clock, tone: 'border-[#eadfff] bg-[#faf7ff] text-[#7c4dff]' },
];

const STATUS_FILTERS: { id: 'all' | 'dispatched' | 'credit'; label: string }[] = [
  { id: 'dispatched', label: 'נמסר לספק' },
  { id: 'credit', label: 'זיכוי לא נרשם' },
  { id: 'all', label: 'הכל' },
];

const COLUMNS = ['מס׳ החזרה', 'תאריך', 'ספק', 'סטטוס', 'כמות פריטים', 'סכום החזרה', 'סכום זיכוי', 'פעולות'];

const ils = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const iconInk = 'text-[#1e293b]';
const secondaryButton = `inline-flex h-12 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 text-[15px] font-bold shadow-[0_4px_12px_rgba(15,23,42,0.05)] disabled:cursor-not-allowed disabled:opacity-60 ${iconInk}`;
const primaryButton = 'inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-l from-[#1ed4a8] to-[#0ea5a0] px-5 text-base font-extrabold text-white shadow-[0_8px_18px_rgba(14,165,160,0.28)] disabled:cursor-not-allowed disabled:opacity-50';

interface DraftLine {
  key: string;
  productId: string;
  name: string;
  barcode: string | null;
  onHand: number;
  quantity: number;
  costText: string;
}

const money = (value: number | null) => (value === null ? 'לא זמין' : ils.format(value));

export const SupplierReturnsV2: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusinessId } = useActiveBusiness();
  const [supplierId, setSupplierId] = useState('');
  const [reasonId, setReasonId] = useState<ReturnReasonId | ''>('');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [listSearch, setListSearch] = useState('');
  const [period, setPeriod] = useState('all');
  const [status, setStatus] = useState<'all' | 'dispatched' | 'credit'>('all');
  const [formNote, setFormNote] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [savedReturn, setSavedReturn] = useState<string | null>(null);
  const requestKey = React.useRef<{ signature: string; key: string } | null>(null);

  const suppliers = useQuery({
    queryKey: ['supplier-return-suppliers', activeBusinessId],
    enabled: !!activeBusinessId,
    queryFn: () => fetchBusinessSuppliers(activeBusinessId!, 'local'),
  });
  const catalog = useQuery({
    queryKey: ['supplier-return-products', activeBusinessId, productSearch],
    enabled: !!activeBusinessId && productSearch.trim().length >= 2,
    queryFn: async () => {
      const term = productSearch.trim().replace(/%/g, '');
      const { data, error } = await supabase.from('products').select('id, name, barcode, quantity, cost').eq('business_id', activeBusinessId!).ilike('name', `%${term}%`).limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const draftLines: ReturnDraftLine[] = lines.map((line) => {
    const parsed = moneyInputValid(line.costText);
    return { productId: line.productId, quantity: line.quantity, onHand: line.onHand, unitCost: parsed === false ? Number.NaN : parsed };
  });
  const issues = returnDraftIssues({
    supplierId: supplierId || null,
    reasonId,
    lines: draftLines,
  });
  const total = returnDraftTotal(draftLines.map((line) => ({ quantity: line.quantity, unitCost: Number.isFinite(line.unitCost) ? line.unitCost : null })));

  const resetDraft = () => {
    setSupplierId('');
    setReasonId('');
    setNotes('');
    setProductSearch('');
    setLines([]);
    setFormNote(null);
  };
  const addProduct = (row: { id: string; name: string; barcode: string | null; quantity: number; cost: number | null }) => {
    if (lines.some((line) => line.productId === row.id)) {
      setFormNote('המוצר כבר נמצא בהחזרה.');
      return;
    }
    if (!Number.isInteger(row.quantity) || row.quantity < 1) {
      setFormNote('אין מלאי פיזי למוצר הזה. הוא לא נוסף.');
      return;
    }
    setLines((current) => [...current, {
      key: crypto.randomUUID(),
      productId: row.id,
      name: row.name,
      barcode: row.barcode,
      onHand: row.quantity,
      quantity: 1,
      costText: row.cost === null || row.cost === undefined ? '' : String(row.cost),
    }]);
    setProductSearch('');
    setFormNote(null);
  };
  const confirmDispatch = async () => {
    if (!SUPPLIER_RETURN_DISPATCH_READY || pending || !activeBusinessId || !reasonId || issues.length > 0) return;
    const signature = supplierReturnCanonical({
      businessId: activeBusinessId,
      supplierId,
      reasonId,
      notes,
      lines: draftLines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitCost: Number.isFinite(line.unitCost) ? line.unitCost : null })),
    });
    const request = requestKey.current?.signature === signature ? requestKey.current : { signature, key: crypto.randomUUID() };
    requestKey.current = request;
    setPending(true);
    try {
      const saved = await confirmSupplierReturnDispatch({
        businessId: activeBusinessId,
        supplierId,
        reason: reasonId,
        notes,
        lines: draftLines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitCost: Number.isFinite(line.unitCost) ? line.unitCost : null })),
        idempotencyKey: request.key,
      });
      setSavedReturn(`${saved.returnNumber} · ${saved.movementIds.length} תנועות מלאי`);
      resetDraft();
      setConfirmOpen(false);
    } catch (error) {
      setFormNote(error instanceof Error ? error.message : DISPATCH_CLOSED);
    } finally {
      setPending(false);
    }
  };

  return (
    <div data-screen="supplier-returns" className="font-[Heebo] text-v2-text" dir="rtl">
      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[#e7f1ff] text-[#2f6fe0]" aria-hidden>
            <Package className="h-8 w-8" strokeWidth={1.6} />
          </span>
          <div>
            <h1 className="text-[28px] font-extrabold leading-none text-[#1e293b] md:text-[34px]">החזרות וזיכויים מספקים</h1>
            <p className="mt-2 text-sm text-[#64748b]">ניהול החזרות לספקים, מעקב אחר מסירה וזיכויים כספיים</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="#new-return" className={primaryButton}>
            <Plus className="h-5 w-5" aria-hidden />החזרה חדשה
          </a>
          <button type="button" className={secondaryButton} disabled title="דוח החזרות וזיכויים עדיין אינו זמין.">
            <BarChart3 className="h-4 w-4" aria-hidden />דוח החזרות וזיכויים
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_4px_12px_rgba(15,23,42,0.05)] ${iconInk}`} aria-label="פעולות נוספות">
              <MoreHorizontal className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onClick={() => navigate('/procurement?tab=orders')}>הזמנות רכש</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/procurement/receiving')}>קליטת סחורה</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="סיכום החזרות">
        {KPIS.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className={cn('flex min-h-[108px] items-center gap-3 rounded-2xl border px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]', card.tone)}>
              <Icon className="h-9 w-9 shrink-0" strokeWidth={1.75} aria-hidden />
              <div>
                <p className="text-[13px] font-semibold">{card.label}</p>
                <p className="text-[28px] font-extrabold leading-tight">לא זמין</p>
                <p className="text-[11px] font-semibold opacity-80">ספר ההחזרות כבוי</p>
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
        <form id="new-return" className="rounded-[22px] border border-[#e6eef6] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]" onSubmit={(event) => event.preventDefault()}>
          <h2 className="mb-3 text-lg font-extrabold text-[#1e293b]">יצירת החזרה חדשה</h2>
          <label className="mb-3 block text-sm font-bold">ספק
            <select aria-label="ספק" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={`mt-1 h-12 w-full rounded-2xl border border-[#e2e8f0] bg-white px-3 text-sm font-semibold ${iconInk}`}>
              <option value="">{suppliers.isLoading ? 'טוען ספקים' : 'בחירת ספק'}</option>
              {(suppliers.data ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          {suppliers.isError && <p className="mb-2 text-xs font-semibold text-[#c2410c]">הספקים לא נטענו. לא נוצר ספק חדש.</p>}
          <label className="mb-3 block text-sm font-bold">סיבת החזרה
            <select aria-label="סיבת החזרה" value={reasonId} onChange={(event) => setReasonId(event.target.value as ReturnReasonId | '')} className={`mt-1 h-12 w-full rounded-2xl border border-[#e2e8f0] bg-white px-3 text-sm font-semibold ${iconInk}`}>
              <option value="">בחירת סיבה</option>
              {RETURN_REASONS.map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}
            </select>
          </label>
          <label className="mb-3 block text-sm font-bold">הערה
            <input aria-label="הערה להחזרה" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="הערה (אופציונלי)" className="mt-1 h-12 w-full rounded-2xl border border-[#e2e8f0] px-3 text-sm" />
          </label>
          <p className="mb-2 text-sm font-extrabold">פריטי מוצרים להחזרה</p>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" aria-hidden />
            <input aria-label="חיפוש מוצר להחזרה" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="חיפוש מוצר מהקטלוג" className="h-12 w-full rounded-2xl border border-[#e2e8f0] pr-10 pl-3 text-sm" />
            {productSearch.trim().length >= 2 && (
              <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-2xl border border-[#e6eef6] bg-white shadow-lg">
                {catalog.isLoading && <li className="px-3 py-2 text-sm text-[#64748b]">טוען</li>}
                {catalog.isError && <li className="px-3 py-2 text-sm text-[#c2410c]">המוצרים לא נטענו.</li>}
                {(catalog.data ?? []).map((row) => (
                  <li key={row.id}>
                    <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-sm hover:bg-[#f8fbfa]" onClick={() => addProduct(row)}>
                      <span className="font-semibold">{row.name}</span>
                      <span className="text-xs text-[#64748b]">במלאי <Bidi>{row.quantity}</Bidi></span>
                    </button>
                  </li>
                ))}
                {catalog.data && catalog.data.length === 0 && <li className="px-3 py-2 text-sm text-[#64748b]">אין מוצר תואם.</li>}
              </ul>
            )}
          </div>
          <ul className="space-y-2">
            {lines.map((line) => {
              const parsed = moneyInputValid(line.costText);
              const unitCost = parsed === false ? null : parsed;
              return (
                <li key={line.key} className="rounded-2xl border border-[#e6eef6] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{line.name}</p>
                      <p className="text-xs text-[#64748b]">{line.barcode || 'בלי ברקוד'} · במלאי <Bidi>{line.onHand}</Bidi></p>
                    </div>
                    <button type="button" aria-label={`הסרת ${line.name}`} className="grid h-9 w-9 place-items-center rounded-xl text-[#e11d48]" onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <label>כמות
                      <input aria-label={`כמות ${line.name}`} type="number" min={1} max={line.onHand} value={line.quantity} onChange={(event) => {
                        const next = Number(event.target.value);
                        setLines((current) => current.map((row) => row.key === line.key ? { ...row, quantity: Number.isFinite(next) ? next : row.quantity } : row));
                      }} className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] px-2 font-bold" />
                    </label>
                    <label>עלות יחידה
                      <input aria-label={`עלות ${line.name}`} inputMode="decimal" value={line.costText} onChange={(event) => setLines((current) => current.map((row) => row.key === line.key ? { ...row, costText: event.target.value } : row))} className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] px-2" />
                    </label>
                    <p className="self-end pb-2 font-extrabold text-[#14944a]">{money(lineTotal(line.quantity, unitCost))}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-[#64748b]">העלות המוצעת היא עלות הקטלוג הנוכחית. שינוי כאן נשאר בטיוטה ואינו מעדכן את היסטוריית הרכש.</p>
          <div className="mt-3 rounded-2xl bg-[#f4fbf7] px-3 py-3 text-center font-extrabold text-[#14944a]">
            סה״כ החזרה: {money(total)}
          </div>
          {formNote && <p className="mt-2 text-xs font-semibold text-[#c2410c]" role="status">{formNote}</p>}
          {issues.length > 0 && lines.length > 0 && <p className="mt-2 text-xs font-semibold text-[#c2410c]">{issues[0]}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" className={cn(secondaryButton, 'flex-1 justify-center')} onClick={resetDraft} disabled={pending}>ביטול</button>
            <button type="button" className={cn(primaryButton, 'flex-1 justify-center')} disabled={issues.length > 0 || pending} onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />אישור מסירה
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-[#c2410c]" role="status">{DISPATCH_CLOSED}</p>
          {savedReturn && <p className="mt-2 text-xs font-semibold text-[#128a45]" role="status">נשמר: {savedReturn}</p>}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent dir="rtl" className="font-[Heebo]">
              <DialogTitle>אישור מסירה פיזית</DialogTitle>
              <DialogDescription>{DISPATCH_CONFIRMATION}</DialogDescription>
              <p className="text-sm text-[#64748b]">{CREDIT_NOT_A_STOCK_EXIT}</p>
              <p className="text-sm font-bold">סה״כ החזרה: {money(total)}. זיכוי: לא נרשם.</p>
              <button type="button" className={cn(primaryButton, 'w-full justify-center')} disabled={!SUPPLIER_RETURN_DISPATCH_READY || pending} onClick={confirmDispatch}>
                אישור והפחתה מהמלאי
              </button>
              {!SUPPLIER_RETURN_DISPATCH_READY && <p className="text-xs font-semibold text-[#c2410c]" role="status">{DISPATCH_CLOSED}</p>}
            </DialogContent>
          </Dialog>
        </form>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-12 max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-2xl border border-[#e6eef6] bg-[#f8fafc] p-1" role="group" aria-label="סינון סטטוס החזרה">
              {STATUS_FILTERS.map((item) => (
                <button key={item.id} type="button" aria-pressed={status === item.id} onClick={() => setStatus(item.id)} className={cn('h-10 shrink-0 rounded-xl px-3 text-sm font-bold', status === item.id ? 'bg-gradient-to-l from-[#1ed4a8] to-[#0ea5a0] text-white' : iconInk)}>
                  {item.label}
                </button>
              ))}
            </div>
            <label className="relative">
              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" aria-hidden />
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" aria-hidden />
              <select aria-label="תקופת החזרות" value={period} onChange={(event) => setPeriod(event.target.value)} className={`h-12 appearance-none rounded-2xl border border-[#e2e8f0] bg-white pr-9 pl-9 text-sm font-bold ${iconInk}`}>
                <option value="all">כל התקופות</option>
                <option value="month">החודש</option>
                <option value="year">השנה</option>
              </select>
            </label>
            <label className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" aria-hidden />
              <input aria-label="חיפוש החזרה" value={listSearch} onChange={(event) => setListSearch(event.target.value)} placeholder="חיפוש לפי מספר החזרה, ספק או מוצר" className="h-12 w-full rounded-2xl border border-[#e2e8f0] bg-white pr-10 pl-3 text-sm shadow-[0_4px_12px_rgba(15,23,42,0.04)]" />
            </label>
          </div>

          <section className="overflow-hidden rounded-[22px] border border-[#e6eef6] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-right text-sm">
                <thead className="bg-[#f6f8fb] text-[#7b8798]">
                  <tr>{COLUMNS.map((column) => <th key={column} className="px-3 py-3 font-semibold">{column}</th>)}</tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-10 text-center">
                      <p className="font-extrabold text-[#1e293b]">ההחזרות אינן זמינות</p>
                      <p className="mx-auto mt-1 max-w-md text-sm text-[#64748b]">{LEDGER_UNAVAILABLE}</p>
                      {(listSearch || status !== 'all' || period !== 'all') && <p className="mt-2 text-xs text-[#64748b]">הסינון נשמר על המסך ואינו מציג שורות לדוגמה.</p>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#e6eef6] bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]" aria-label="תהליך החזרה וזיכוי">
            <h2 className="mb-3 font-extrabold">מסירה וזיכוי</h2>
            <ol className="grid gap-3 lg:grid-cols-2">
              <li className="rounded-2xl border border-[#dce8fb] bg-[#f5f9ff] p-3">
                <Truck className="mb-2 h-6 w-6 text-[#2f6fe0]" aria-hidden />
                <p className="font-extrabold">מסירה פיזית</p>
                <p className="mt-1 text-xs text-[#64748b]">המלאי יורד רק אחרי אישור שהסחורה יצאה מהעסק. אין שריון נפרד.</p>
              </li>
              <li className="rounded-2xl border border-[#eadfff] bg-[#faf7ff] p-3">
                <Coins className="mb-2 h-6 w-6 text-[#7c4dff]" aria-hidden />
                <p className="font-extrabold">זיכוי ספק</p>
                <p className="mt-1 text-xs text-[#64748b]">{CREDIT_NOT_A_STOCK_EXIT}</p>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
};
