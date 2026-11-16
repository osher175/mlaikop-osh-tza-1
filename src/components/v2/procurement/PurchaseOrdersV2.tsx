import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, MoreHorizontal, Package, RotateCcw, ScanLine, Search, Settings, ShoppingCart, Truck, Wallet,
} from 'lucide-react';
import { Bidi } from '@/components/v2';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { usePurchaseOrders } from '@/hooks/v2/usePurchaseOrders';
import {
  canReceive, filterOrders, lineTotal, ORDER_STATUS_LABEL, orderTotals, ordersWritable, type OrderPeriod, type OrderStatus,
} from '@/lib/v2/purchaseOrder';
import type { PersistedOrder } from '@/lib/v2/purchaseOrderWrite';
import { NewPurchaseOrderDialog } from '@/components/v2/procurement/NewPurchaseOrderDialog';

const COLUMNS = ['מס׳ הזמנה', 'תאריך', 'ספק', 'סטטוס', 'סה״כ הזמנה', 'נקלט', 'יתרה', 'אספקה צפויה', 'פעולות'];

const KPIS = [
  { label: 'סה״כ רכש החודש', icon: Wallet, tone: 'border-[#d7f3ec] bg-[#f4fcf9] text-[#12a394]' },
  { label: 'נסגרו החודש', icon: CheckCircle2, tone: 'border-[#d9f5e4] bg-[#f4fbf7] text-[#1a9a52]' },
  { label: 'יתרות פתוחות', icon: AlertTriangle, tone: 'border-[#fde8d2] bg-[#fffaf5] text-[#e08a2a]' },
  { label: 'בדרך / מאושרות', icon: Package, tone: 'border-[#eadfff] bg-[#faf7ff] text-[#7c4dff]' },
  { label: 'הזמנות החודש', icon: ClipboardList, tone: 'border-[#dce8fb] bg-[#f5f9ff] text-[#2f6fe0]' },
];

const STATUS_TONE: Record<OrderStatus, string> = {
  draft: 'bg-[#eef2f6] text-[#526174]',
  awaiting_receipt: 'bg-[#f4ecff] text-[#7c3aed]',
  partially_received: 'bg-[#fff4e8] text-[#e07a12]',
  completed: 'bg-[#e7f8ef] text-[#128a45]',
  cancelled: 'bg-[#f4f6f8] text-[#8b97a6]',
};

const ils = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 });

const iconInk = 'text-[#1e293b]';
const secondaryButton = `inline-flex h-12 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 text-[15px] font-bold shadow-[0_4px_12px_rgba(15,23,42,0.05)] ${iconInk}`;
const primaryButton = 'inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-l from-[#1ed4a8] to-[#0ea5a0] px-5 text-base font-extrabold text-white shadow-[0_8px_18px_rgba(14,165,160,0.28)]';

interface PurchaseOrdersV2Props {
  scanning?: boolean;
  onScanShortages?: () => void;
  onOpenShortages?: () => void;
  onOpenRequests?: () => void;
  onOpenSettings?: () => void;
}

/** Purchase-order dashboard. Values stay unavailable while the ledger is off. */
export const PurchaseOrdersV2: React.FC<PurchaseOrdersV2Props> = ({
  scanning = false,
  onScanShortages,
  onOpenShortages,
  onOpenRequests,
  onOpenSettings,
}) => {
  const ledger = usePurchaseOrders();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [period, setPeriod] = useState<OrderPeriod>('month');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const writable = ordersWritable();
  const today = new Date().toISOString().slice(0, 10);
  const rows = useMemo(() => filterOrders(ledger.orders, search, status, period, today), [ledger.orders, period, search, status, today]);
  const filtered = search !== '' || status !== 'all' || period !== 'month';
  const selected = rows.find((order) => order.id === selectedId) ?? ledger.orders.find((order) => order.id === selectedId) ?? null;
  const editing = ledger.orders.find((order) => order.id === editingId && order.status === 'draft') ?? null;
  const agreed = ledger.orders.filter((order) => order.status !== 'draft' && order.status !== 'cancelled' && order.orderedOn.slice(0, 7) === today.slice(0, 7));
  const monthAmount = agreed.some((order) => orderTotals(order.lines).amount === null) ? null : agreed.reduce((sum, order) => sum + (orderTotals(order.lines).amount ?? 0), 0);
  const valuesReady = writable && !ledger.isLoading && !ledger.isError;

  return (
    <div data-screen="purchase-orders-visual" className="font-[Heebo] text-v2-text" dir="rtl">
      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <Truck className="h-12 w-12 shrink-0 text-[#14b8a6]" strokeWidth={1.6} aria-hidden />
          <div>
            <h2 className="text-[28px] font-extrabold leading-none text-[#1e293b] md:text-[34px]">רכש והזמנות ספקים</h2>
            <p className="mt-2 text-sm text-[#64748b]">ניהול הזמנות רכש, קליטות סחורה ומעקב אחר אספקות ויתרות</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setEditingId(null); setCreating(true); }} className={primaryButton}>
            <ShoppingCart className="h-5 w-5 text-white" aria-hidden />הזמנה חדשה
          </button>
          <Link to="/procurement/receiving" className={secondaryButton}>
            <Package className="h-4 w-4" aria-hidden />קליטת סחורה
          </Link>
          <Link to="/procurement/returns" className={secondaryButton}>
            <RotateCcw className="h-4 w-4" aria-hidden />החזרה לספק
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_4px_12px_rgba(15,23,42,0.05)] ${iconInk}`} aria-label="פעולות נוספות">
              <MoreHorizontal className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {onOpenShortages && <DropdownMenuItem className="gap-2" onClick={onOpenShortages}><AlertTriangle className="h-4 w-4 text-[#e07a12]" />חוסרים</DropdownMenuItem>}
              {onOpenRequests && <DropdownMenuItem className="gap-2" onClick={onOpenRequests}><ClipboardList className="h-4 w-4 text-[#1d6fe0]" />בקשות רכש וטיוטות</DropdownMenuItem>}
              {onOpenSettings && <DropdownMenuItem className="gap-2" onClick={onOpenSettings}><Settings className={`h-4 w-4 ${iconInk}`} />הגדרות רכש</DropdownMenuItem>}
              {onScanShortages && (
                <DropdownMenuItem className="gap-2" onClick={onScanShortages} disabled={scanning}>
                  <ScanLine className={`h-4 w-4 ${iconInk}`} />
                  {scanning ? 'סורק חוסרים...' : 'סרוק חוסרים ופתח בקשות'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-5" aria-label="סיכום רכש">
        {KPIS.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className={cn('flex min-h-[108px] items-center gap-3 rounded-2xl border px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]', card.tone)}>
              <Icon className="h-9 w-9 shrink-0" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-5">{card.label}</p>
                <p className="mt-1 text-[28px] font-extrabold leading-none">{valuesReady ? kpiValue(card.label, ledger.orders, agreed.length, monthAmount) : 'לא זמין'}</p>
                <p className="mt-2 text-[11px] font-medium opacity-70">{writable && !ledger.isError ? (ledger.isLoading ? 'טוען' : 'מההזמנות השמורות') : 'ספר ההזמנות כבוי'}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex h-12 max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[#e6eef6] bg-[#f8fafc] p-1 shadow-[0_4px_12px_rgba(15,23,42,0.04)]" role="group" aria-label="סינון סטטוס">
          {(['awaiting_receipt', 'partially_received', 'completed', 'draft', 'cancelled'] as OrderStatus[]).map((item) => (
            <button key={item} type="button" aria-pressed={status === item} onClick={() => setStatus(status === item ? 'all' : item)}
              className={cn('h-10 shrink-0 rounded-xl px-3 text-sm font-bold', status === item ? 'bg-gradient-to-l from-[#1ed4a8] to-[#0ea5a0] text-white shadow-sm' : iconInk)}>
              {ORDER_STATUS_LABEL[item]}
            </button>
          ))}
          <button type="button" aria-pressed={status === 'all'} onClick={() => setStatus('all')} className={cn('h-10 shrink-0 rounded-xl px-4 text-sm font-bold', status === 'all' ? 'bg-gradient-to-l from-[#1ed4a8] to-[#0ea5a0] text-white shadow-sm' : iconInk)}>
            כל ההזמנות
          </button>
        </div>
        <label className="relative">
          <CalendarDays className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${iconInk}`} aria-hidden />
          <ChevronDown className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${iconInk}`} aria-hidden />
          <select aria-label="תקופה" value={period} onChange={(event) => setPeriod(event.target.value as OrderPeriod)} className={`h-12 appearance-none rounded-2xl border border-[#e2e8f0] bg-white pr-9 pl-9 text-sm font-bold shadow-[0_4px_12px_rgba(15,23,42,0.04)] ${iconInk}`}>
            <option value="month">החודש</option>
            <option value="days30">30 יום</option>
            <option value="year">השנה</option>
            <option value="all">כל התקופות</option>
          </select>
        </label>
        <label className="relative w-full lg:w-72">
          <Search className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${iconInk}`} aria-hidden />
          <input aria-label="חיפוש הזמנה" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי מספר הזמנה, ספק או עובד" className="h-12 w-full rounded-2xl border border-[#e2e8f0] bg-white pr-10 pl-3 text-sm shadow-[0_4px_12px_rgba(15,23,42,0.04)]" />
        </label>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-[#e6eef6] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
            <thead className="bg-[#f6f8fb] text-[#7b8798]">
              <tr>{COLUMNS.map((column) => <th key={column} className="px-3 py-2.5 text-right text-xs font-bold">{column}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-14 text-center">
                    <LedgerState filtered={filtered} count={rows.length} loading={ledger.isLoading} error={ledger.isError} />
                  </td>
                </tr>
              ) : rows.map((order) => <OrderRow key={order.id} order={order} selected={selected?.id === order.id} onSelect={() => setSelectedId(selected?.id === order.id ? null : order.id)} />)}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-3 md:hidden">
          {rows.length === 0 ? <LedgerState filtered={filtered} count={rows.length} loading={ledger.isLoading} error={ledger.isError} /> : (
            <div className="space-y-2">
              {rows.map((order) => (
                <button key={order.id} type="button" onClick={() => setSelectedId(selected?.id === order.id ? null : order.id)} className={cn('w-full rounded-[16px] border p-3 text-right shadow-sm transition-colors', selected?.id === order.id ? 'border-[#12b981] bg-[#e7f8f4]' : 'border-[#e6eef6] hover:bg-[#f8fbfa]')}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-extrabold">{order.number ?? 'טיוטה בלי מספר'}</span>
                    <StatusBadge status={order.status} />
                  </span>
                  <span className="mt-1 block text-sm text-v2-muted">{order.supplierName} · {showDate(order.orderedOn)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selected && (
          <OrderDetail order={selected} onEdit={selected.status === 'draft' && writable ? () => setEditingId(selected.id) : undefined} />
        )}
      </section>
      {!selected && (
        <p className="mt-3 text-sm text-v2-muted">פירוט הזמנה נפתח מתחת לטבלה רק אחרי בחירת הזמנה. כרגע אין הזמנה לבחירה.</p>
      )}
      {!writable && <p className="mt-2 text-xs font-semibold text-[#c2410c]" role="status">ספר ההזמנות כבוי. אין כאן סכום, סטטוס או שמירה. זה אינו מצב של אפס הזמנות.</p>}
      {notice && <p className={cn('mt-2 text-sm font-semibold', notice.includes('כבויה') ? 'text-[#c2410c]' : 'text-[#128a45]')} role="status">{notice}</p>}
      <NewPurchaseOrderDialog
        open={creating || editing !== null}
        order={editing}
        onClose={() => { setCreating(false); setEditingId(null); }}
        onSaved={async ({ id, confirm }) => {
          await ledger.reload();
          setSelectedId(id);
          setCreating(false);
          setEditingId(null);
          setNotice(confirm
            ? 'ההזמנה נשמרה וממתינה לקליטה. לא נשלח דבר לספק ולא השתנה מלאי.'
            : 'הטיוטה נשמרה בלי מספר הזמנה. אפשר לפתוח אותה שוב כדי לעדכן או לאשר.');
        }}
      />
    </div>
  );
};

const LedgerState: React.FC<{ filtered: boolean; count: number; loading: boolean; error: boolean }> = ({ filtered, count, loading, error }) => (
  <div>
    <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-[18px] bg-[#f4f7fb] text-[#7b8798] shadow-sm" aria-hidden>
      <ClipboardList className="h-6 w-6" />
    </span>
    <p className="text-base font-extrabold">{error ? 'ההזמנות לא נטענו' : loading ? 'טוען הזמנות' : ordersWritable() ? (count === 0 ? 'אין הזמנות' : '') : 'ההזמנות אינן זמינות'}</p>
    <p className="mx-auto mt-1 max-w-md text-sm text-v2-muted">
      {error
        ? 'אפשר לנסות שוב. לא נוצרה הזמנה.'
        : ordersWritable()
          ? (filtered ? 'אין הזמנה שמתאימה לסינון.' : 'עדיין לא נשמרה הזמנת רכש.')
          : 'אי אפשר לדעת אם יש הזמנות כל עוד הספר כבוי. החיפוש והמסננים מוכנים, ואין כאן הזמנות לדוגמה.'}
    </p>
  </div>
);

const money = (amount: number | null) => (amount === null ? 'לא זמין' : ils.format(amount));

const showDate = (value: string | null) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
};

const sumBy = (order: PersistedOrder, quantity: (line: PersistedOrder['lines'][number]) => number) => {
  let total = 0;
  for (const line of order.lines) {
    const units = quantity(line);
    const part = lineTotal(units, line.unitCost);
    if (part === null && units > 0) return null;
    total += part ?? 0;
  }
  return total;
};

const kpiValue = (label: string, orders: PersistedOrder[], agreedCount: number, monthAmount: number | null) => {
  if (label === 'סה״כ רכש החודש') return money(monthAmount);
  if (label === 'נסגרו החודש') return String(orders.filter((order) => order.status === 'completed').length);
  if (label === 'יתרות פתוחות') return String(orders.filter((order) => order.status === 'awaiting_receipt' || order.status === 'partially_received').length);
  if (label === 'בדרך / מאושרות') return String(orders.filter((order) => order.status === 'awaiting_receipt').length);
  return String(agreedCount);
};

const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => (
  <span className={cn('inline-flex h-7 items-center rounded-full px-2.5 text-xs font-bold', STATUS_TONE[status])}>{ORDER_STATUS_LABEL[status]}</span>
);

const OrderRow: React.FC<{ order: PersistedOrder; selected: boolean; onSelect: () => void }> = ({ order, selected, onSelect }) => {
  const totals = orderTotals(order.lines);
  const received = order.lines.reduce((sum, line) => sum + line.receivedQty, 0);
  return (
    <tr className={cn('border-t border-[#eef3f8] transition-colors hover:bg-[#f8fbfa]', selected && 'bg-[#e7f8f4]')}>
      <td className="px-3 py-2.5 font-extrabold">{order.number ?? 'טיוטה'}</td>
      <td className="px-3 py-2.5">{showDate(order.orderedOn)}</td>
      <td className="px-3 py-2.5">{order.supplierName}</td>
      <td className="px-3 py-2.5"><StatusBadge status={order.status} /></td>
      <td className="px-3 py-2.5">{money(totals.amount)}</td>
      <td className="px-3 py-2.5">{received}</td>
      <td className="px-3 py-2.5">{Math.max(0, totals.units - received)}</td>
      <td className="px-3 py-2.5">{showDate(order.expectedOn)}</td>
      <td className="px-3 py-2.5">
        <button type="button" className={`inline-flex h-8 items-center gap-1 rounded-full border border-[#d7dee7] bg-white px-3 text-xs font-bold ${iconInk}`} onClick={onSelect}><ClipboardList className="h-3.5 w-3.5" aria-hidden />פירוט</button>
      </td>
    </tr>
  );
};

const OrderDetail: React.FC<{ order: PersistedOrder; onEdit?: () => void }> = ({ order, onEdit }) => {
  const totals = orderTotals(order.lines);
  const receivedUnits = order.lines.reduce((sum, line) => sum + line.receivedQty, 0);
  const remainingUnits = Math.max(0, totals.units - receivedUnits);
  const receivedValue = sumBy(order, (line) => line.receivedQty);
  const outstandingValue = sumBy(order, (line) => Math.max(0, line.quantity - line.receivedQty));
  const progress = totals.units > 0 ? Math.min(100, Math.round((receivedUnits / totals.units) * 100)) : null;
  return (
    <section className="border-t border-[#e6eef6] bg-white" aria-label="פירוט הזמנה">
      <header className="flex flex-wrap items-start justify-between gap-3 bg-[#f6f8fb] px-4 py-3">
        <div>
          <h3 className="text-lg font-extrabold">{order.number ?? 'טיוטה בלי מספר'}</h3>
          <p className="mt-1 text-sm text-v2-muted">{order.supplierName} · {order.employeeName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          {onEdit && <button type="button" onClick={onEdit} className={`h-10 rounded-[14px] border border-[#d7dee7] bg-white px-4 text-sm font-bold ${iconInk}`}>עריכת טיוטה</button>}
          {canReceive(order.status) && (
            <Link to={`/procurement/receiving?order=${order.id}`} className={`${primaryButton} h-10 px-4 text-sm`}><Package className="h-4 w-4 text-white" aria-hidden />קליטת ההזמנה</Link>
          )}
        </div>
      </header>
      <div className="space-y-3 p-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="שווי הזמנה" value={money(totals.amount)} />
        <Metric label="שווי שנקלט" value={money(receivedValue)} />
        <Metric label="יתרה פתוחה" value={money(outstandingValue)} />
        <Metric label="אספקה צפויה" value={showDate(order.expectedOn)} />
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs font-bold text-v2-muted">
          <span>התקדמות קליטה</span>
          <span>{progress === null ? 'אין כמויות' : `${receivedUnits} מתוך ${totals.units}`}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#e6eef6]" aria-hidden>
          <div className="h-full rounded-full bg-gradient-to-l from-[#1ed4a8] to-[#0ea5a0]" style={{ width: `${progress ?? 0}%` }} />
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-[#7b8798]">
            <tr>
              {['מוצר', 'הוזמן', 'נקלט', 'נותר'].map((column) => <th key={column} className="px-2 py-2 text-right text-xs font-bold">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => {
              const remaining = Math.max(0, line.quantity - line.receivedQty);
              return (
                <tr key={line.key} className="border-t border-[#eef3f8]">
                  <td className="px-2 py-2 font-bold">{[line.brand, line.model || 'מוצר', line.sizeLabel || 'מידה לא רשומה'].filter(Boolean).join(' · ')}</td>
                  <td className="px-2 py-2 font-extrabold text-[#243044]">{line.quantity}</td>
                  <td className="px-2 py-2 font-bold text-[#14944a]">{line.receivedQty}</td>
                  <td className={cn('px-2 py-2 font-extrabold', remaining > 0 ? 'text-[#e07a12]' : 'text-[#14944a]')}>{remaining}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm font-bold">סה״כ מחיר רכישה שהוזן: <Bidi>{money(totals.amount)}</Bidi>. אין פירוק מע״מ, ואין תאריך אספקה נפרד לכל שורה.</p>
      </div>
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <article className="rounded-[16px] border border-[#e6eef6] bg-white px-3 py-2.5 shadow-sm">
    <p className="text-xs font-bold text-v2-muted">{label}</p>
    <p className="mt-1 text-base font-extrabold">{value}</p>
  </article>
);
