import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Minus, PackagePlus, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchBusinessSuppliers } from '@/hooks/useSuppliers';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useEmployees } from '@/hooks/v2/useEmployees';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Bidi } from '@/components/v2';
import { cn } from '@/lib/utils';
import {
  confirmProblems, draftProblems, lineReady, lineTotal, moneyInputValid, orderTotals, ordersWritable, type OrderLineInput,
} from '@/lib/v2/purchaseOrder';
import { savePurchaseOrder, type PersistedOrder } from '@/lib/v2/purchaseOrderWrite';

const ils = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 });
const SIZE = /\d{3}\/\d{2}\s?R\d{2}/i;
const fieldClass = 'h-11 w-full rounded-[14px] border border-[#dbe4ee] bg-white px-3 text-sm font-semibold sm:h-10';
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const blank = (): OrderLineInput => ({
  key: crypto.randomUUID(), productId: null, brand: '', model: '', sizeLabel: '', loadIndex: '', speedRating: '',
  quantity: 1, unitCost: null, supplierSku: null, barcode: null, description: null,
});

export const NewPurchaseOrderDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  order?: PersistedOrder | null;
  onSaved?: (result: { id: string; confirm: boolean }) => void | Promise<void>;
}> = ({ open, onClose, order = null, onSaved }) => {
  const { activeBusinessId } = useActiveBusiness();
  const employees = useEmployees(true);
  const [orderedOn, setOrderedOn] = useState(today);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [expectedOn, setExpectedOn] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<OrderLineInput[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<OrderLineInput>(blank);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestKey = useRef(crypto.randomUUID());
  const session = useRef<string | null>(null);
  const writable = ordersWritable();
  const access = useQuery({
    queryKey: ['can-business-write', activeBusinessId],
    enabled: open && writable && !!activeBusinessId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_business_write', { p_business_id: activeBusinessId! });
      if (error) throw error;
      return data === true;
    },
  });
  const authorized = writable && access.data === true;
  const totals = orderTotals(lines);
  const draftIssues = draftProblems({ supplierId, employeeId, lines });
  const confirmIssues = confirmProblems({ supplierId, employeeId, lines });
  const canDraft = authorized && !pending && !sealed && draftIssues.length === 0;
  const canConfirm = authorized && !pending && !sealed && confirmIssues.length === 0;
  useEffect(() => {
    if (!open) {
      session.current = null;
      return;
    }
    const token = order ? `${order.id}:${order.version}` : 'new';
    if (session.current === token) return;
    session.current = token;
    requestKey.current = crypto.randomUUID();
    setSealed(false);
    setSaveError(null);
    setPending(false);
    setOrderedOn(order?.orderedOn ?? today());
    setSupplierId(order?.supplierId ?? null);
    setEmployeeId(order?.orderingEmployeeId ?? null);
    setReference(order?.supplierReference ?? '');
    setExpectedOn(order?.expectedOn ?? '');
    setNotes(order?.notes ?? '');
    setLines(order ? order.lines.map((line) => ({ ...line })) : []);
    setDraft(blank());
    setDraftError(null);
  }, [open, order]);
  const suppliers = useQuery({
    queryKey: ['v2-po-suppliers', activeBusinessId, 'local'],
    enabled: open && !!activeBusinessId,
    queryFn: async () => fetchBusinessSuppliers(activeBusinessId!, 'local'),
  });
  const products = useQuery({
    queryKey: ['v2-po-products', activeBusinessId, search],
    enabled: open && mode === 'existing' && !!activeBusinessId && search.trim().length >= 2,
    queryFn: async () => {
      const term = search.trim().replace(/%/g, '');
      const { data, error } = await supabase.from('products').select('id, name, barcode, brands(name)').eq('business_id', activeBusinessId!).ilike('name', `%${term}%`).limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addCatalog = (row: { id: string; name: string; barcode: string | null; brands: { name: string } | { name: string }[] | null }) => {
    const brand = Array.isArray(row.brands) ? row.brands[0]?.name : row.brands?.name;
    setLines((current) => [...current, {
      ...blank(), productId: row.id, brand: brand ?? '', model: row.name, sizeLabel: row.name.match(SIZE)?.[0] ?? '', barcode: row.barcode,
    }]);
    setSearch('');
  };
  const addNew = () => {
    const problem = lineReady(draft, true);
    if (problem) { setDraftError(problem); return; }
    setLines((current) => [...current, draft]);
    setDraft(blank());
    setDraftError(null);
  };
  const save = async (confirm: boolean) => {
    if (pending || sealed || !activeBusinessId) return;
    const issues = confirm ? confirmIssues : draftIssues;
    if (!authorized || issues.length > 0) return;
    setPending(true);
    setSaveError(null);
    try {
      const saved = await savePurchaseOrder({
        businessId: activeBusinessId,
        idempotencyKey: requestKey.current,
        confirm,
        orderId: order?.id ?? null,
        expectedVersion: order?.version ?? null,
        supplierId,
        employeeId,
        orderedOn,
        expectedOn: expectedOn || null,
        supplierReference: reference || null,
        notes: notes || null,
        lines,
      });
      setSealed(true);
      await onSaved?.({ id: saved.id, confirm });
    } catch (error) {
      setSealed(false);
      setSaveError(error instanceof Error ? error.message : 'ההזמנה לא נשמרה.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent
        dir="rtl"
        data-screen="new-purchase-order-visual"
        className="v2-root left-1/2 top-0 flex h-[100dvh] w-full max-w-none translate-x-[-50%] translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-[#f5f8fc] p-0 font-[Heebo] sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-1rem)] sm:w-[min(1180px,calc(100%-1.5rem))] sm:translate-y-[-50%] sm:rounded-[22px] [&>button]:hidden"
        onOpenAutoFocus={(event) => {
          const close = (event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>('[data-order-close]');
          if (close) { event.preventDefault(); close.focus(); }
        }}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e6eef6] bg-white px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#e7f8f4] text-[#12a37a]" aria-hidden>
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-[22px] font-extrabold leading-none">{order ? 'עריכת טיוטת הזמנה' : 'הזמנת רכש חדשה'}</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-v2-muted">תיעוד הזמנה מול ספק לצורך מעקב, קליטה ועדכון מלאי</DialogDescription>
            </div>
          </div>
          <button type="button" data-order-close aria-label="סגירה" onClick={onClose} className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[#dbe4ee] bg-white px-3 text-sm font-bold">
            <X className="h-4 w-4" aria-hidden />סגירה
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          <section className="rounded-[18px] border border-[#e6eef6] bg-white p-3 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold"><CalendarDays className="h-4 w-4 text-[#12b981]" aria-hidden />פרטי הזמנה</h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
              <Field label="תאריך הזמנה" required><input type="date" aria-label="תאריך הזמנה" value={orderedOn} onChange={(event) => setOrderedOn(event.target.value)} className={fieldClass} /></Field>
              <Field label="ספק" required>
                <select aria-label="ספק" value={supplierId ?? ''} onChange={(event) => setSupplierId(event.target.value || null)} className={fieldClass}>
                  <option value="">בחירת ספק</option>
                  {(suppliers.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                {suppliers.isError && <span className="text-xs font-semibold text-v2-red">רשימת הספקים לא נטענה.</span>}
              </Field>
              <Field label="מי הזמין" required>
                <select aria-label="מי הזמין" value={employeeId ?? ''} onChange={(event) => setEmployeeId(event.target.value || null)} className={fieldClass}>
                  <option value="">בחירת עובד</option>
                  {employees.employees.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.display_name}</option>)}
                </select>
                {employees.isError && <span className="text-xs font-semibold text-v2-red">רשימת העובדים לא נטענה.</span>}
              </Field>
              <Field label="אספקה צפויה"><input type="date" aria-label="אספקה צפויה" value={expectedOn} onChange={(event) => setExpectedOn(event.target.value)} className={fieldClass} /></Field>
              <Field label="איש קשר אצל הספק"><input aria-label="איש קשר אצל הספק" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="אופציונלי" className={fieldClass} /></Field>
            </div>
          </section>

          <section className="rounded-[18px] border border-[#e6eef6] bg-white p-3 shadow-sm">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 text-sm font-extrabold"><PackagePlus className="h-4 w-4 text-[#12b981]" aria-hidden />פרטי ההזמנה</h3>
              <div className="flex rounded-[14px] bg-[#f4f7fb] p-1" role="group" aria-label="אופן הוספת מוצר">
                <button type="button" aria-pressed={mode === 'existing'} className={cn('h-10 rounded-[12px] px-4 text-sm font-extrabold', mode === 'existing' ? 'bg-[#12b981] text-white' : 'text-v2-navy')} onClick={() => setMode('existing')}>מוצר קיים</button>
                <button type="button" aria-pressed={mode === 'new'} className={cn('h-10 rounded-[12px] px-4 text-sm font-extrabold', mode === 'new' ? 'bg-[#12b981] text-white' : 'text-v2-navy')} onClick={() => setMode('new')}>מפרט חדש</button>
              </div>
            </div>

            {mode === 'existing' ? (
              <div className="rounded-[16px] border border-[#e6eef6] bg-[#f8fbfd] p-2.5">
                <p className="mb-1.5 text-sm font-bold">חיפוש מוצר מהקטלוג</p>
                <input aria-label="חיפוש מוצר קיים" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="שם המוצר. הבחירה נשמרת לפי מזהה, לא לפי מותג ומידה." className={fieldClass} />
                {search.trim().length >= 2 && (
                  <ul className="mt-2 max-h-48 overflow-y-auto rounded-[14px] border border-[#e6eef6] bg-white">
                    {(products.data ?? []).map((row) => {
                      const brand = Array.isArray(row.brands) ? row.brands[0]?.name : row.brands?.name;
                      const size = row.name.match(SIZE)?.[0];
                      return (
                        <li key={row.id} className="border-b border-[#f1f5f9] last:border-0">
                          <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-3 text-right hover:bg-[#f4fbf8]" onClick={() => addCatalog(row)}>
                            <span>
                              <span className="block font-extrabold">{row.name}</span>
                              <span className="mt-0.5 block text-xs text-v2-muted">{brand || 'מותג לא רשום בקטלוג'} · מידה {size ?? 'לא רשומה בשם'} · ברקוד {row.barcode ?? 'אין'}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-[#e7f8f4] px-3 py-1 text-xs font-extrabold text-[#0f9f6e]">הוספה</span>
                          </button>
                        </li>
                      );
                    })}
                    {(products.data ?? []).length === 0 && !products.isLoading && <li className="px-3 py-3 text-sm text-v2-muted">אין מוצר תואם. אפשר לרשום מפרט חדש בלי ליצור מוצר מלאי.</li>}
                    {products.isError && <li className="px-3 py-3 text-sm font-semibold text-v2-red">חיפוש המוצרים נכשל.</li>}
                  </ul>
                )}
              </div>
            ) : (
              <div className="rounded-[16px] border border-[#e6eef6] bg-[#f8fbfd] p-3">
                <p className="mb-3 text-sm font-bold">מפרט צמיג שעדיין אין בקטלוג</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="מותג" required><input aria-label="מותג" value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} className={fieldClass} /></Field>
                  <Field label="דגם" required><input aria-label="דגם" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} className={fieldClass} /></Field>
                  <Field label="מידה" required><input aria-label="מידה" value={draft.sizeLabel} placeholder="205/55R16" onChange={(event) => setDraft({ ...draft, sizeLabel: event.target.value })} className={fieldClass} /></Field>
                  <Field label="עומס" required><input aria-label="עומס" value={draft.loadIndex} placeholder="91" onChange={(event) => setDraft({ ...draft, loadIndex: event.target.value })} className={fieldClass} /></Field>
                  <Field label="מהירות" required><input aria-label="מהירות" value={draft.speedRating} placeholder="V" onChange={(event) => setDraft({ ...draft, speedRating: event.target.value })} className={fieldClass} /></Field>
                  <Field label="כמות" required><input aria-label="כמות במפרט" inputMode="numeric" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} className={fieldClass} /></Field>
                  <Field label="עלות ליחידה" required><input aria-label="עלות במפרט" value={draft.unitCost ?? ''} placeholder="0.00" onChange={(event) => { const money = moneyInputValid(event.target.value); if (money !== false) setDraft({ ...draft, unitCost: money }); }} className={fieldClass} /></Field>
                  <Field label="מק״ט ספק"><input aria-label="מק״ט ספק" value={draft.supplierSku ?? ''} onChange={(event) => setDraft({ ...draft, supplierSku: event.target.value || null })} className={fieldClass} /></Field>
                  <Field label="ברקוד"><input aria-label="ברקוד" value={draft.barcode ?? ''} onChange={(event) => setDraft({ ...draft, barcode: event.target.value || null })} className={fieldClass} /></Field>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Field label="תיאור"><input aria-label="תיאור" value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value || null })} className={fieldClass} /></Field>
                  </div>
                </div>
                <button type="button" className="mt-3 inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#12b981] px-4 font-extrabold text-white" onClick={addNew}>
                  <Plus className="h-4 w-4" aria-hidden />הוספת המפרט להזמנה
                </button>
                <p className="mt-2 text-xs text-v2-muted">המפרט נשמר בהזמנה בלבד. מוצר מלאי נוצר רק בקליטה מאושרת, אם אין התאמה חד-משמעית.</p>
                {draftError && <p className="mt-2 text-sm font-bold text-v2-red" role="alert">{draftError}</p>}
              </div>
            )}

            <div className={cn('mt-3 space-y-2', lines.length > 0 && 'max-h-[min(34vh,320px)] overflow-y-auto')}>
              {lines.length === 0 && <p className="rounded-[14px] border border-dashed border-[#dbe4ee] px-3 py-2.5 text-center text-sm text-v2-muted">עדיין אין שורות. מוצר שנוסף מופיע כאן עם מידה, עומס, כמות, עלות וסה״כ שורה.</p>}
              {lines.map((line) => <TireLine key={line.key} line={line} setLines={setLines} />)}
            </div>
          </section>

          <div className="grid gap-2 lg:grid-cols-[220px_1fr]">
            <div className="rounded-[18px] bg-[#e7f8f2] p-3">
              <p className="text-xs font-bold text-[#0f9f6e]">{totals.lines} שורות · {totals.units} יחידות</p>
              <p className="mt-1 text-sm font-bold text-v2-navy">סה״כ הזמנה</p>
              <p className="mt-1 text-[26px] font-extrabold leading-none text-[#0f9f6e]">{totals.amount === null ? 'לא זמין' : <Bidi>{ils.format(totals.amount)}</Bidi>}</p>
              <p className="mt-1.5 text-[11px] leading-snug text-[#3d6b5a]">הסכום הוא מחיר הרכישה שהוזן. אין פירוק מע״מ, כי מחירי הספק אינם מסומנים ככוללים או לא כוללים מע״מ.</p>
            </div>
            <label className="rounded-[18px] border border-[#e6eef6] bg-white p-3 text-sm font-bold text-v2-muted">הערות נוספות
              <textarea aria-label="הערות" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="למשל: תנאי אספקה, הערות למחסן, מספר הזמנה אצל הספק" className="mt-1.5 min-h-[4.25rem] w-full resize-y rounded-[14px] border border-[#dbe4ee] px-3 py-2 font-normal text-v2-text" />
            </label>
          </div>
          {confirmIssues.length > 0 && (lines.length > 0 || supplierId || employeeId) && (
            <ul className="rounded-[14px] bg-[#fff1f2] px-3 py-2 text-sm font-semibold text-v2-red" role="alert">
              {confirmIssues.slice(0, 4).map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          )}
          {saveError && <p className="rounded-[14px] bg-[#fff1f2] px-3 py-2 text-sm font-bold text-v2-red" role="alert">{saveError}</p>}
          {!writable && <p className="rounded-[14px] bg-[#fff7ed] px-3 py-2 text-xs font-semibold text-[#c2410c]">שמירה כטיוטה ושמירת הזמנה כבויות. טיוטה אינה הזמנה שסוכמה, ואין שמירה מקומית במקום הספר.</p>}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#e6eef6] bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#dbe4ee] px-4 font-bold">
            <X className="h-4 w-4" aria-hidden />ביטול
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={!canDraft} title={writable ? (draftIssues[0] ?? 'שמירה כטיוטה') : 'ספר ההזמנות כבוי'} className={cn('h-11 rounded-[14px] border border-[#dbe4ee] px-4 font-bold', !canDraft && 'opacity-50')} onClick={() => { void save(false); }}>{pending ? 'שומר…' : 'שמירה כטיוטה'}</button>
            <button type="button" disabled={!canConfirm} title={writable ? (confirmIssues[0] ?? 'שמירת הזמנה') : 'ספר ההזמנות כבוי'} className={cn('h-11 rounded-[14px] bg-[#12b981] px-5 font-extrabold text-white', !canConfirm && 'opacity-50')} onClick={() => { void save(true); }}>{pending ? 'שומר…' : 'שמירת הזמנה'}</button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block text-xs font-extrabold text-[#607086]">{required ? `* ${label}` : label}<span className="mt-1 block font-normal">{children}</span></label>
);

const TireLine: React.FC<{ line: OrderLineInput; setLines: React.Dispatch<React.SetStateAction<OrderLineInput[]>> }> = ({ line, setLines }) => {
  const total = lineTotal(line.quantity, line.unitCost);
  const loadSpeed = [line.loadIndex, line.speedRating].filter(Boolean).join('') || 'לא רשום';
  return (
    <article className="rounded-[18px] border border-[#e6eef6] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold">{line.model || 'בלי דגם'}</p>
          <p className="mt-0.5 text-xs font-bold text-[#0f9f6e]">{line.brand || 'מותג לא רשום'} · {line.productId ? 'מוצר קיים' : 'מפרט חדש, בלי מלאי'}</p>
          {line.barcode && <p className="mt-0.5 text-xs text-v2-muted">ברקוד <Bidi>{line.barcode}</Bidi></p>}
        </div>
        <button type="button" aria-label="הסרת שורה" onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))} className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[#dbe4ee] text-[#b42318]">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-[140px_140px_1fr_140px_150px] md:items-end">
        <Spec label="מידה" value={line.sizeLabel || 'לא רשומה'} />
        <Spec label="עומס / מהירות" value={loadSpeed} />
        <div>
          <p className="mb-1 text-[11px] font-extrabold text-[#607086]">כמות</p>
          <span className="inline-flex h-12 items-center rounded-[14px] border border-[#dbe4ee] bg-[#f8fbfd]">
            <button type="button" aria-label="הוספה" className="grid h-12 w-11 place-items-center" onClick={() => setLines((current) => current.map((row) => row.key === line.key ? { ...row, quantity: row.quantity + 1 } : row))}><Plus className="h-4 w-4" /></button>
            <input aria-label={`כמות ${line.model || 'שורה'}`} inputMode="numeric" value={line.quantity} className="h-12 w-14 bg-transparent text-center text-base font-extrabold" onChange={(event) => setLines((current) => current.map((row) => row.key === line.key ? { ...row, quantity: Number(event.target.value) } : row))} />
            <button type="button" aria-label="הפחתה" disabled={line.quantity <= 1} className="grid h-12 w-11 place-items-center disabled:opacity-40" onClick={() => setLines((current) => current.map((row) => row.key === line.key ? { ...row, quantity: Math.max(1, row.quantity - 1) } : row))}><Minus className="h-4 w-4" /></button>
          </span>
        </div>
        <label className="text-[11px] font-extrabold text-[#607086]">עלות ליחידה
          <input aria-label={`עלות ${line.model || 'שורה'}`} value={line.unitCost ?? ''} placeholder="עלות" className="mt-1 h-12 w-full rounded-[14px] border border-[#dbe4ee] px-3 text-sm font-bold" onChange={(event) => {
            const money = moneyInputValid(event.target.value);
            if (money !== false) setLines((current) => current.map((row) => row.key === line.key ? { ...row, unitCost: money } : row));
          }} />
        </label>
        <div className="col-span-2 rounded-[14px] bg-[#e7f8f2] px-3 py-2 text-center md:col-span-1">
          <p className="text-[11px] font-bold text-[#0f9f6e]">סה״כ שורה</p>
          <p className="text-lg font-extrabold text-[#0f9f6e]">{line.unitCost === null || total === null ? 'לא זמין' : <Bidi>{ils.format(total)}</Bidi>}</p>
        </div>
      </div>
    </article>
  );
};

const Spec: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[14px] bg-[#f6f8fb] px-3 py-2">
    <p className="text-[11px] font-extrabold text-[#607086]">{label}</p>
    <p className="truncate text-sm font-extrabold"><Bidi>{value}</Bidi></p>
  </div>
);
