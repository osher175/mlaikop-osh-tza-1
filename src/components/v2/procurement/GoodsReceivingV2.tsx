import React, { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, CalendarDays, CheckCircle2, Package, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useEmployees } from '@/hooks/v2/useEmployees';
import { usePurchaseOrders } from '@/hooks/v2/usePurchaseOrders';
import { receiptPostingAvailable } from '@/lib/v2/goodsReceipt';
import { canReceive, ordersWritable, receivablePurchaseOrders } from '@/lib/v2/purchaseOrder';
import { explainPurchaseReceiptError, postPurchaseReceipt, receiptAttemptSignature, receiptErrorText, type PurchaseReceiptLine } from '@/lib/v2/purchaseReceiptWrite';

const LINE_COLUMNS = ['מוצר', 'מידה', 'הוזמן', 'נקלט קודם', 'יתרה', 'לקליטה עכשיו', 'עלות ליחידה', 'סה״כ שורה'];

/**
 * Receiving layout. With the ledger off there is no order to fill, and nothing here changes stock.
 */
export const GoodsReceivingV2: React.FC = () => {
  if (!receiptPostingAvailable()) return <ClosedReceiving />;
  return <OpenReceiving />;
};

const ClosedReceiving: React.FC = () => {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const posting = receiptPostingAvailable();
  const ledger = ordersWritable();
  const blocked = !ledger || !posting;

  return (
    <div dir="rtl" data-screen="goods-receiving-visual" className="min-w-0 font-[Heebo] text-v2-text">
      <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[#e7f8f4] text-[#12a37a]" aria-hidden>
            <Package className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-[26px] font-extrabold leading-none md:text-[30px]">קליטת סחורה</h1>
            <p className="mt-1.5 max-w-xl text-sm text-v2-muted">קליטת מלאי או חלקית של הזמנת רכש ועדכון עלויות. הזמנה לבדה אינה מגדילה מלאי.</p>
          </div>
        </div>
        <Link to="/procurement" className="inline-flex h-11 items-center gap-2 self-start rounded-[14px] border border-[#dbe4ee] bg-white px-4 font-bold shadow-sm">
          <ArrowRight className="h-4 w-4" aria-hidden />חזרה להזמנות
        </Link>
      </header>

      <p className="mb-4 rounded-[16px] bg-[#fff7ed] px-4 py-3 text-sm font-semibold text-[#c2410c]" role="status">
        {orderId
          ? 'התקבל מזהה הזמנה, אבל ספר ההזמנות כבוי ולכן אין מספר, ספק, כמויות או מחירים. המלאי לא משתנה.'
          : 'אין הזמנה לקליטה. בוחרים הזמנה שממתינה לאספקה או באספקה חלקית. טיוטה, הזמנה שהושלמה והזמנה שבוטלה אינן נפתחות לקליטה.'}
        {blocked ? ' הקליטה בפועל כבויה.' : ''}
      </p>

      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="פרטי ההזמנה לקליטה">
        <Info icon={CalendarDays} label="תאריך הזמנה" value="לא זמין" />
        <Info icon={ClipboardMark} label="מס׳ הזמנה" value={orderId ? 'לא נטען' : 'אין הזמנה'} />
        <Info icon={Truck} label="ספק" value="לא זמין" />
        <Info icon={Boxes} label="סטטוס הזמנה" value="לא זמין" tone="text-[#c2410c]" />
      </section>
      <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {['סה״כ הזמנה', 'נקלט עד כה', 'יתרה פתוחה'].map((label) => (
          <article key={label} className="rounded-[18px] border border-[#e6eef6] bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-v2-muted">{label}</p>
            <p className="mt-1 text-2xl font-extrabold">לא זמין</p>
          </article>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-[20px] border border-[#e6eef6] bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold">סיכום קליטה</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between"><dt className="text-v2-muted">פריטים לקליטה</dt><dd className="font-extrabold">לא זמין</dd></div>
            <div className="flex items-center justify-between"><dt className="text-v2-muted">כמות</dt><dd className="font-extrabold">לא זמין</dd></div>
          </dl>
          <div className="mt-4 rounded-[16px] bg-[#e7f8f2] px-3 py-3">
            <p className="text-xs font-bold text-[#0f9f6e]">עלות כוללת</p>
            <p className="text-2xl font-extrabold text-[#0f9f6e]">לא זמין</p>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm font-semibold text-v2-muted">
            <input type="checkbox" disabled className="mt-1" />
            עדכון עלות הרכש הנוכחית. ההזמנה המקורית אינה נדרסת, ומחיר מכירה היסטורי אינו משתנה.
          </label>
        </aside>

        <section className="overflow-hidden rounded-[20px] border border-[#e6eef6] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#eef3f8] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-v2-muted">קליטה מלאה מקבלת את היתרה הפתוחה בלבד. שורה שלא נבחרה אינה נקלטה.</p>
            <div className="flex rounded-[14px] bg-[#f4f7fb] p-1" role="group" aria-label="סוג קליטה">
              <button type="button" disabled className="h-11 rounded-[12px] bg-[#12b981] px-4 text-sm font-extrabold text-white opacity-60">קליטה חלקית</button>
              <button type="button" disabled className="h-11 rounded-[12px] px-4 text-sm font-extrabold opacity-60">קליטה מלאה</button>
            </div>
          </div>
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f8fb] text-[#7b8798]">
                <tr>{LINE_COLUMNS.map((column) => <th key={column} className="px-3 py-3 text-right text-xs font-bold">{column}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={LINE_COLUMNS.length} className="px-4 py-12 text-center">
                    <Package className="mx-auto mb-2 h-6 w-6 text-[#9aa6b5]" aria-hidden />
                    <p className="font-extrabold">אין שורות לקליטה</p>
                    <p className="mt-1 text-sm text-v2-muted">הטבלה תציג את שורות ההזמנה אחרי שההזמנה נטענת. אין כאן מוצרים לדוגמה.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-10 text-center md:hidden">
            <p className="font-extrabold">אין שורות לקליטה</p>
            <p className="mt-1 text-sm text-v2-muted">במובייל כל שורה תוצג ככרטיס מוצר, לא כטבלה חתוכה.</p>
          </div>
          <label className="block border-t border-[#eef3f8] p-4 text-sm font-bold text-v2-muted">הערות לקליטה
            <textarea aria-label="הערות לקליטה" disabled rows={3} placeholder="ההערות יישמרו רק עם קליטה מאושרת" className="mt-2 w-full rounded-[14px] border border-[#dbe4ee] bg-[#f8fafc] px-3 py-2 font-normal" />
          </label>
        </section>
      </div>

      <footer className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" disabled title="סגירת יתרה אינה מגדילה מלאי, והפעולה כבויה" className="h-12 rounded-[14px] border border-[#dbe4ee] bg-white px-4 font-bold opacity-60">סגור יתרה שלא סופקה</button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled className="h-12 rounded-[14px] border border-[#dbe4ee] bg-white px-4 font-bold opacity-60">שמור טיוטה</button>
          <button type="button" disabled className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#12b981] px-5 font-extrabold text-white opacity-50">
            <CheckCircle2 className="h-4 w-4" aria-hidden />אישור קליטה
          </button>
        </div>
      </footer>
      <p className="mt-2 text-xs text-v2-muted">טיוטה {canReceive('draft') ? 'פתוחה לקליטה' : 'סגורה לקליטה'}. קליטה חלקית ומלאה מחשבות רק יתרה פתוחה, ומחיר שסוכם בהזמנה אינו נדרס.</p>
    </div>
  );
};

type LineChoice = { kind: 'existing'; productId: string; label: string } | { kind: 'create' };

const OpenReceiving: React.FC = () => {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const { activeBusinessId } = useActiveBusiness();
  const ledger = usePurchaseOrders();
  const eligible = receivablePurchaseOrders(ledger.orders);
  const employees = useEmployees(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [resolutions, setResolutions] = useState<Record<string, LineChoice>>({});
  const [searchLineId, setSearchLineId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [updateCost, setUpdateCost] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const requestKey = useRef<{ signature: string; key: string } | null>(null);
  const order = useQuery({
    queryKey: ['purchase-receipt-order', activeBusinessId, orderId],
    enabled: !!activeBusinessId && !!orderId,
    queryFn: async () => {
      const header = await supabase.from('purchase_orders').select('id, order_number, status, ordered_on').eq('id', orderId!).eq('business_id', activeBusinessId!).maybeSingle();
      if (header.error) throw header.error;
      const lines = await supabase.from('purchase_order_lines').select('id, brand, model, size_label, ordered_qty, received_qty, agreed_unit_cost, product_id').eq('purchase_order_id', orderId!).eq('business_id', activeBusinessId!);
      if (lines.error) throw lines.error;
      return { header: header.data, lines: lines.data ?? [] };
    },
  });
  const catalog = useQuery({
    queryKey: ['purchase-receipt-products', activeBusinessId, search],
    enabled: !!activeBusinessId && !!searchLineId && search.trim().length >= 2,
    queryFn: async () => {
      const term = search.trim().replace(/%/g, '');
      const { data, error } = await supabase.from('products').select('id, name, barcode').eq('business_id', activeBusinessId!).ilike('name', `%${term}%`).limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });
  const receiptLines: PurchaseReceiptLine[] = (order.data?.lines ?? []).map((line) => {
    const choice = resolutions[line.id];
    return {
      lineId: line.id,
      quantity: quantities[line.id] ?? 0,
      agreedUnitCost: line.agreed_unit_cost,
      storedProductId: line.product_id,
      choice: choice?.kind === 'create' ? 'create' : choice?.kind === 'existing' ? choice.productId : null,
    };
  });
  const signature = receiptAttemptSignature({ orderId, employeeId, updateCurrentCost: updateCost, lines: receiptLines });
  const active = employees.employees.filter((employee) => employee.is_active);
  const receivable = order.data?.header && ['awaiting_receipt', 'partially_received'].includes(order.data.header.status);
  const unresolved = receiptLines.some((line) => line.quantity > 0 && !line.storedProductId && line.choice == null);

  const confirm = async () => {
    if (!activeBusinessId || !orderId || !employeeId || !order.data || pending || unresolved) return;
    if (requestKey.current?.signature !== signature) requestKey.current = { signature, key: crypto.randomUUID() };
    const key = requestKey.current.key;
    setPending(true);
    setMessage(null);
    try {
      const result = await postPurchaseReceipt({
        businessId: activeBusinessId,
        orderId,
        employeeId,
        idempotencyKey: key,
        updateCurrentCost: updateCost,
        lines: receiptLines,
      });
      setMessage(result.replayed ? 'הקליטה כבר נרשמה. המלאי לא הוגדל שוב.' : 'הקליטה נרשמה והמלאי עודכן פעם אחת.');
      void order.refetch();
    } catch (error) {
      setMessage(explainPurchaseReceiptError(receiptErrorText(error)));
    } finally {
      setPending(false);
    }
  };

  return (
    <div dir="rtl" className="min-w-0 font-[Heebo] text-v2-text">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold">קליטת סחורה</h1>
        <Link to="/procurement" className="inline-flex h-11 items-center gap-2 rounded-[14px] border px-4 font-bold"><ArrowRight className="h-4 w-4" />חזרה להזמנות</Link>
      </header>
      {!orderId && (
        <section className="space-y-3" aria-label="הזמנות שממתינות לקליטה">
          {ledger.isLoading && <p>טוען הזמנות שממתינות לקליטה…</p>}
          {ledger.isError && <p role="alert">לא הצלחנו לטעון את ההזמנות הפתוחות. המלאי לא השתנה.</p>}
          {!ledger.isLoading && !ledger.isError && eligible.length === 0 && (
            <p role="status">אין הזמנה לקליטה. בוחרים הזמנה שממתינה לאספקה או באספקה חלקית. טיוטה, הזמנה שהושלמה והזמנה שבוטלה אינן נפתחות לקליטה.</p>
          )}
          {eligible.map((candidate) => {
            const open = candidate.lines.reduce((sum, line) => sum + Math.max(0, line.quantity - line.receivedQty), 0);
            return (
              <Link key={candidate.id} to={`/procurement/receiving?order=${candidate.id}`} className="block rounded-[16px] border px-4 py-3 font-bold">
                {candidate.number ?? 'הזמנה'} · {candidate.supplierName} · יתרה {open}
              </Link>
            );
          })}
        </section>
      )}
      {order.isLoading && <p>טוען את ההזמנה…</p>}
      {order.isError && <p role="alert">לא הצלחנו לטעון את ההזמנה. המלאי לא השתנה.</p>}
      {order.data && !receivable && <p role="status">ההזמנה אינה ממתינה לקליטה. המלאי לא השתנה.</p>}
      {receivable && order.data?.header && (
        <section className="space-y-3">
          <p className="font-bold">הזמנה {order.data.header.order_number ?? order.data.header.id}</p>
          <div className="grid gap-2">
            {active.map((employee) => (
              <button key={employee.id} type="button" className={`h-12 rounded-2xl border font-bold ${employeeId === employee.id ? 'bg-v2-primary text-white' : ''}`} onClick={() => setEmployeeId(employee.id)}>{employee.display_name}</button>
            ))}
          </div>
          {order.data.lines.map((line) => {
            const open = Math.max(0, line.ordered_qty - line.received_qty);
            const choice = resolutions[line.id];
            const quantity = quantities[line.id] ?? 0;
            return (
              <div key={line.id} className="rounded-[16px] border p-3">
                <span className="font-bold">{[line.brand, line.model, line.size_label].filter(Boolean).join(' ') || 'שורה'}</span>
                <span className="mx-2 text-sm text-v2-muted">יתרה {open}</span>
                <input aria-label="כמות לקליטה" type="number" min={0} max={open} value={quantity} onChange={(event) => {
                  const next = Math.min(open, Math.max(0, Number(event.target.value) || 0));
                  setQuantities((current) => ({ ...current, [line.id]: next }));
                }} className="mt-2 h-11 w-24 rounded-xl border px-2" />
                {line.product_id ? (
                  <p className="mt-2 text-sm text-v2-muted">מקושר למוצר במלאי. קליטה חלקית הבאה תשתמש באותו מזהה.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-v2-muted">השורה אינה מקושרת. בחרו מוצר קיים לפי מזהה, או צרו מוצר חדש במפורש.</p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="קישור מוצר">
                      <button type="button" aria-pressed={choice?.kind === 'existing'} className="h-10 rounded-xl border px-3 text-sm font-bold" onClick={() => { setSearchLineId(line.id); setSearch(''); setResolutions((current) => { const next = { ...current }; delete next[line.id]; return next; }); }}>מוצר קיים</button>
                      <button type="button" aria-pressed={choice?.kind === 'create'} className="h-10 rounded-xl border px-3 text-sm font-bold" onClick={() => { setSearchLineId(null); setResolutions((current) => ({ ...current, [line.id]: { kind: 'create' } })); }}>יצירת מוצר חדש</button>
                    </div>
                    {choice?.kind === 'existing' && <p className="text-sm font-bold">נבחר: {choice.label}</p>}
                    {choice?.kind === 'create' && <p className="text-sm font-bold">בקליטה ייווצר מוצר חדש מהמפרט, והקישור יישמר לשורה.</p>}
                    {searchLineId === line.id && (
                      <div>
                        <input aria-label="חיפוש מוצר קיים" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי שם. הבחירה נשמרת לפי מזהה, ורק אחרי לחיצה." className="h-11 w-full rounded-xl border px-3" />
                        {catalog.isError && <p className="mt-1 text-sm text-v2-red">רשימת המוצרים לא נטענה. לא נבחר מוצר.</p>}
                        {search.trim().length >= 2 && !catalog.isLoading && (catalog.data ?? []).length === 0 && <p className="mt-1 text-sm">אין מוצר ברשימה. לא נבחרה התאמה.</p>}
                        <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border">
                          {(catalog.data ?? []).map((row) => (
                            <li key={row.id} className="border-b last:border-0">
                              <button type="button" className="w-full px-3 py-2 text-right text-sm font-bold" onClick={() => {
                                setResolutions((current) => ({ ...current, [line.id]: { kind: 'existing', productId: row.id, label: row.name } }));
                                setSearchLineId(null);
                                setSearch('');
                              }}>{row.name}{row.barcode ? ` · ${row.barcode}` : ''}</button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {quantity > 0 && !choice && <p className="text-sm font-semibold text-[#c2410c]">לפני הקליטה חסר מזהה מוצר לשורה הזו.</p>}
                  </div>
                )}
              </div>
            );
          })}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={updateCost} onChange={(event) => setUpdateCost(event.target.checked)} />עדכון עלות הרכש הנוכחית. עלות חסרה נשארת חסרה.</label>
          {unresolved && <p role="status">יש שורה לקליטה בלי מוצר. בחרו מוצר קיים או יצירה מפורשת. המלאי לא השתנה.</p>}
          <button type="button" disabled={pending || !employeeId || unresolved} onClick={() => { void confirm(); }} className="h-12 rounded-[14px] bg-[#12b981] px-5 font-extrabold text-white disabled:opacity-50">אישור קליטה</button>
          {message && <p role={message.includes('נרשמה') ? 'status' : 'alert'}>{message}</p>}
        </section>
      )}
    </div>
  );
};

const ClipboardMark = Package;

const Info: React.FC<{ icon: React.FC<{ className?: string }>; label: string; value: string; tone?: string }> = ({ icon: Icon, label, value, tone }) => (
  <article className="flex items-center justify-between gap-3 rounded-[18px] border border-[#e6eef6] bg-white px-4 py-3 shadow-sm">
    <div>
      <p className="text-xs font-bold text-v2-muted">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${tone ?? ''}`}>{value}</p>
    </div>
    <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#f4f7fb] text-[#12a37a]" aria-hidden><Icon className="h-5 w-5" /></span>
  </article>
);
