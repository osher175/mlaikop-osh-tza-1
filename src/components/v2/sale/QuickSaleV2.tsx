import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useUserRole } from '@/hooks/useUserRole';
import { useDebounce } from '@/hooks/use-debounce';
import { useCostVisibility } from '@/hooks/useCostVisibility';
import { useInventoryProductsPage, type InventoryProduct } from '@/hooks/useInventoryProductsPage';
import { useEmployees } from '@/hooks/v2/useEmployees';
import { useSaleDraft } from '@/hooks/v2/useSaleDraft';
import { QUICK_SALE_PERSISTENCE_READY } from '@/lib/v2/employeeAttribution';
import {
  addDraftLine, clearSaleDraft, quantityOnDraft, removeDraftLine, setDraftNotes, setDraftPrice, setDraftQuantity, setDraftSalesperson,
} from '@/lib/v2/saleDraft';
import { quoteDraft } from '@/lib/v2/saleQuote';
import { completeQuickSale } from '@/lib/v2/quickSaleWrite';
import { UNKNOWN_COST_SALE_MESSAGE } from '@/lib/v2/legacyInventoryWrite';
import { reverseQuickSale } from '@/lib/v2/quickSaleReverse';
import { snapshotSaleDiscount } from '@/lib/v2/saleDiscount';
import { sizeFromName } from '@/components/v2/inventory/InventoryV2';
import { SearchInput, v2Button } from '@/components/v2/Controls';
import { Bidi, CurrencyValue } from '@/components/v2/Display';

const ils = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 });
const INVENTORY_QUERY = 'mlaiko.v2.inventoryQuery';

const addProduct = (businessId: string, product: InventoryProduct, quantity: number, axle: 'single' | 'front' | 'rear') => {
  addDraftLine(businessId, {
    productId: product.id,
    name: product.name,
    barcode: product.barcode,
    quantity,
    available: product.quantity,
    unitPriceGross: product.price,
    listUnitGross: product.price,
    unitCost: product.cost,
    axle,
    image: product.image,
    sizeLabel: sizeFromName(product.name),
  });
};

export const QuickSaleV2: React.FC = () => {
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id ?? null;
  const { permissions } = useUserRole();
  const canPrice = !!permissions.canEditProducts;
  const draft = useSaleDraft(businessId);
  const employees = useEmployees(QUICK_SALE_PERSISTENCE_READY);
  const { hidden: costHidden } = useCostVisibility();
  const [mode, setMode] = useState<'single' | 'axle'>('single');
  const [axle, setAxle] = useState<'front' | 'rear'>('front');
  const [search, setSearch] = useState('');
  const [pendingQty, setPendingQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [reversing, setReversing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [salespersonNotice, setSalespersonNotice] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounce(search, 300);
  const results = useInventoryProductsPage(debounced.trim(), 'all', 1, 8);
  const inventoryQuery = (() => { try { return sessionStorage.getItem(INVENTORY_QUERY) ?? ''; } catch { return ''; } })();

  useEffect(() => {
    if (!draft || !employees.ready || employees.isLoading || !draft.salespersonEmployeeId) return;
    const selected = employees.employees.find((employee) => employee.id === draft.salespersonEmployeeId);
    if (selected?.is_active) return;
    setDraftSalesperson(draft.businessId, null);
    setSalespersonNotice(selected ? 'המוכר שנבחר אינו פעיל, ולכן השיוך הוסר.' : 'המוכר שנבחר אינו בעסק הזה, ולכן השיוך הוסר.');
  }, [draft, employees.ready, employees.isLoading, employees.employees]);

  if (!businessId || !draft) return <p className="text-v2-muted font-[Heebo]" dir="rtl">טוען את העסק…</p>;

  const quote = quoteDraft(draft.lines);
  const confirmSale = async () => {
    if (!draft.salespersonEmployeeId) {
      setSaveError('יש לבחור איש מכירות לפני אישור העסקה');
      return;
    }
    if (!quote.costComplete) {
      setSaveError(UNKNOWN_COST_SALE_MESSAGE);
      return;
    }
    if (!QUICK_SALE_PERSISTENCE_READY || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setSavedId(null);
    try {
      const result = await completeQuickSale(draft);
      clearSaleDraft(businessId);
      setSavedId(result.transactionId);
      setSaveError(result.replayed ? 'העסקה כבר נרשמה. לא נוצרה עסקה כפולה.' : null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'הפעולה נכשלה. לא התקבל אישור מהשרת.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const activeEmployees = employees.employees.filter((employee) => employee.is_active);
  const axleOf = mode === 'single' ? 'single' : axle;
  const showResults = debounced.trim().length > 0;

  return (
    <div dir="rtl" className="font-[Heebo] text-v2-text min-w-0 pb-24 md:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-[26px] md:text-[30px] font-extrabold inline-flex items-center gap-2"><ShoppingCart className="h-7 w-7 text-v2-primary" aria-hidden /> מכירה מהירה</h1>
          <p className="text-sm text-v2-muted">מכירת צמיגים ללקוח. הטיוטה נשמרת בדפדפן ואינה עסקה עד לאישור.</p>
        </div>
        <Link to={`/inventory${inventoryQuery ? `?${inventoryQuery}` : ''}`} className={v2Button.secondary}><ArrowRight className="h-4 w-4" aria-hidden /> חזרה למלאי</Link>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <aside className="order-2 lg:order-1 space-y-3">
          <section className="rounded-[18px] border border-v2-border bg-v2-surface shadow-[var(--v2-shadow)] p-4">
            <h2 className="font-extrabold mb-3">מי ביצע את המכירה?</h2>
            {!QUICK_SALE_PERSISTENCE_READY && <p className="text-sm text-v2-muted mb-3">אין רשימת עובדים פעילה. אי אפשר לבחור מוכר, והאישור עדיין לא נשמר.</p>}
            {QUICK_SALE_PERSISTENCE_READY && employees.isError && <p className="text-sm text-v2-red mb-3">לא הצלחנו לטעון את רשימת העובדים.</p>}
            {QUICK_SALE_PERSISTENCE_READY && salespersonNotice && <p className="text-sm text-v2-red mb-3">{salespersonNotice}</p>}
            {QUICK_SALE_PERSISTENCE_READY && !employees.isLoading && !employees.isError && activeEmployees.length === 0 && <p className="text-sm text-v2-muted mb-3">אין עובדים פעילים. בעל העסק צריך להוסיף עובד לפני שאפשר לאשר עסקה.</p>}
            {QUICK_SALE_PERSISTENCE_READY && !draft.salespersonEmployeeId && <p className="text-sm text-v2-red mb-3">יש לבחור איש מכירות לפני אישור העסקה</p>}
            <div className="grid grid-cols-1 gap-2">
              {QUICK_SALE_PERSISTENCE_READY && employees.ready && activeEmployees.map((employee) => {
                const selected = draft.salespersonEmployeeId === employee.id;
                return (
                  <button key={employee.id} type="button" aria-pressed={selected} className={`h-14 rounded-2xl border text-base font-bold ${selected ? 'bg-v2-primary text-white border-v2-primary' : 'bg-v2-surface border-v2-border'}`} onClick={() => { setSalespersonNotice(null); setDraftSalesperson(businessId, employee.id); }}>
                    {employee.display_name}
                  </button>
                );
              })}
              {!QUICK_SALE_PERSISTENCE_READY && (
                <button type="button" aria-pressed={draft.salespersonEmployeeId === null} className={`h-14 rounded-2xl border text-base font-bold ${draft.salespersonEmployeeId === null ? 'bg-v2-navy text-white border-v2-navy' : 'bg-v2-surface border-v2-border'}`} onClick={() => setDraftSalesperson(businessId, null)}>
                  ללא שיוך
                </button>
              )}
            </div>
          </section>

          <section className="rounded-[18px] border border-v2-border bg-v2-surface shadow-[var(--v2-shadow)] p-4 space-y-2 text-sm">
            <h2 className="font-extrabold text-base">סיכום העסקה</h2>
            <SummaryRow label="כמות צמיגים" value={String(quote.units)} strong />
            <SummaryRow label="מחיר לפני מע״מ" value={quote.net === null ? '—' : ils.format(quote.net)} />
            <SummaryRow label={`מע״מ ${pct.format(quote.vatRate * 100)}%`} value={quote.vat === null ? '—' : ils.format(quote.vat)} />
            <SummaryRow label="מחיר כולל מע״מ" value={quote.gross === null ? '—' : ils.format(quote.gross)} strong />
            <SummaryRow label="עלות ידועה" value={quote.knownCost === null ? 'לא ידוע' : ils.format(quote.knownCost)} />
            <div className={`rounded-2xl px-3 py-3 ${quote.costComplete && quote.knownProfit !== null ? 'bg-[#e9f9ef]' : 'bg-v2-table-head'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">רווח גולמי</span>
                <bdi className="text-xl font-extrabold">{quote.knownProfit === null ? 'לא ידוע' : ils.format(quote.knownProfit)}</bdi>
              </div>
              <p className="text-xs mt-1 text-v2-muted">
                {draft.lines.length === 0 ? 'אין עדיין שורות בעסקה.' : quote.marginPct === null ? 'שיעור הרווח אינו מוצג כי כיסוי העלות אינו מלא.' : `שיעור רווח ${pct.format(quote.marginPct)}%`}
              </p>
            </div>
          </section>
        </aside>

        <section className="order-1 lg:order-2 min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`h-12 rounded-2xl font-bold ${mode === 'single' ? 'bg-v2-primary text-white' : 'bg-v2-surface border border-v2-border'}`} onClick={() => { setMode('single'); setPendingQty(1); }}>צמיג בודד</button>
            <button type="button" className={`h-12 rounded-2xl font-bold ${mode === 'axle' ? 'bg-v2-primary text-white' : 'bg-v2-surface border border-v2-border'}`} onClick={() => { setMode('axle'); setPendingQty(2); }}>סט קדמיים ואחוריים</button>
          </div>
          {mode === 'axle' && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`h-11 rounded-2xl font-semibold ${axle === 'front' ? 'bg-v2-navy text-white' : 'bg-v2-surface border border-v2-border'}`} onClick={() => setAxle('front')}>קדמיים</button>
              <button type="button" className={`h-11 rounded-2xl font-semibold ${axle === 'rear' ? 'bg-v2-navy text-white' : 'bg-v2-surface border border-v2-border'}`} onClick={() => setAxle('rear')}>אחוריים</button>
            </div>
          )}

          <div ref={searchRef} className="rounded-[18px] border border-v2-border bg-v2-surface shadow-[var(--v2-shadow)] p-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="flex-1 min-w-[200px]"><SearchInput value={search} onChange={setSearch} label="חיפוש מוצר למכירה" placeholder="שם, מידה, ברקוד או מיקום" /></div>
              <label className="text-sm font-semibold">כמות
                <input type="number" min={1} className="mr-2 h-12 w-20 rounded-v2-control border border-v2-border px-2" value={pendingQty} onChange={(event) => setPendingQty(Math.max(1, Math.floor(Number(event.target.value) || 1)))} />
              </label>
            </div>
            {!showResults && <p className="text-sm text-v2-muted px-1 py-2">חפשו צמיג כדי להוסיף אותו. הקטלוג המלא לא מוצג כאן.</p>}
            {showResults && (
              <ul className="divide-y divide-v2-border">
                {results.products.map((product) => {
                  const room = product.quantity - quantityOnDraft(draft, product.id);
                  return (
                    <li key={product.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="flex items-center gap-2 min-w-0">
                        {product.image ? <img src={product.image} alt="" className="h-10 w-10 rounded-lg object-contain bg-v2-table-head" /> : <span className="h-10 w-10 rounded-lg bg-v2-table-head inline-flex items-center justify-center"><Package className="h-4 w-4 text-v2-muted" aria-hidden /></span>}
                        <span className="min-w-0">
                          <span className="block font-semibold truncate">{product.name}</span>
                          <span className={`text-xs ${room < 1 ? 'text-v2-red font-semibold' : 'text-v2-muted'}`}>{room < 1 ? 'אין מלאי זמין' : `זמין ${room}`} · <CurrencyValue value={product.price} /></span>
                        </span>
                      </span>
                      <button type="button" className={v2Button.secondary} disabled={room < 1} onClick={() => { addProduct(businessId, product, pendingQty, axleOf); setSearch(''); }}>הוספה</button>
                    </li>
                  );
                })}
                {results.products.length === 0 && !results.isLoading && <li className="py-3 text-sm text-v2-muted">לא נמצא מוצר תואם.</li>}
              </ul>
            )}
          </div>

          {draft.lines.length === 0 && <p className="rounded-[18px] border border-dashed border-v2-border bg-v2-surface px-4 py-8 text-center text-sm text-v2-muted">עדיין אין מוצרים בעסקה.</p>}
          {draft.lines.map((line) => {
            const lineTotal = line.unitPriceGross === null ? null : Math.round((line.unitPriceGross * line.quantity + Number.EPSILON) * 100) / 100;
            return (
              <article key={line.key} className="rounded-[18px] border border-v2-border bg-v2-surface shadow-[var(--v2-shadow)] p-4">
                <div className="flex items-start gap-3">
                  {line.image ? <img src={line.image} alt="" className="h-16 w-16 rounded-2xl object-contain bg-v2-table-head shrink-0" /> : <span className="h-16 w-16 rounded-2xl bg-v2-table-head inline-flex items-center justify-center shrink-0"><Package className="h-6 w-6 text-v2-muted" aria-hidden /></span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-extrabold truncate">{line.name}</p>
                        <p className="text-xs text-v2-muted">{line.sizeLabel ? <Bidi>{line.sizeLabel}</Bidi> : 'מידה לא מזוהה'} · {line.axle === 'front' ? 'קדמי' : line.axle === 'rear' ? 'אחורי' : 'בודד'}</p>
                      </div>
                      <button type="button" aria-label="הסרת שורה" className="h-10 w-10 text-v2-red shrink-0" onClick={() => removeDraftLine(businessId, line.key)}><Trash2 className="h-4 w-4 mx-auto" aria-hidden /></button>
                    </div>
                    <span className="mt-2 inline-flex rounded-full bg-[#e9f9ef] px-2.5 py-1 text-xs font-bold text-v2-green">במלאי {line.available}</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <label>כמות
                    <span className="mt-1 flex items-center gap-1">
                      <button type="button" aria-label="הפחתה" className="h-10 w-10 rounded-full border border-v2-border" onClick={() => setDraftQuantity(businessId, line.key, line.quantity - 1)}><Minus className="h-4 w-4 mx-auto" /></button>
                      <span className="w-8 text-center font-extrabold">{line.quantity}</span>
                      <button type="button" aria-label="הוספה" className="h-10 w-10 rounded-full border border-v2-border" onClick={() => setDraftQuantity(businessId, line.key, line.quantity + 1)}><Plus className="h-4 w-4 mx-auto" /></button>
                    </span>
                  </label>
                  <label>מחיר ליחידה
                    {canPrice ? (
                      <input type="number" min={0} max={9999999.99} step="0.01" className="mt-1 h-10 w-full rounded-v2-control border border-v2-border px-2" value={line.unitPriceGross ?? ''} onChange={(event) => {
                        if (event.target.value === '') {
                          setDraftPrice(businessId, line.key, null);
                          return;
                        }
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next) || next < 0) return;
                        setDraftPrice(businessId, line.key, next);
                      }} />
                    ) : (
                      <p className="mt-2 font-semibold">{line.unitPriceGross === null ? 'אין מחיר, ואין הרשאה לקבוע אותו.' : ils.format(line.unitPriceGross)}</p>
                    )}
                  </label>
                  <div>עלות ליחידה
                    <p className="mt-2 font-semibold">{costHidden ? 'מוסתר' : line.unitCost === null ? 'לא ידוע' : ils.format(line.unitCost)}</p>
                  </div>
                  <div>הנחה
                    <p className="mt-2 font-semibold">{(() => {
                      const shot = snapshotSaleDiscount(line.listUnitGross ?? null, lineTotal ?? 0, line.quantity);
                      if (line.listUnitGross == null || shot.discountIls === null) return 'מחיר מחירון לא ידוע';
                      return shot.discountIls === 0 ? 'אין הנחה' : ils.format(shot.discountIls);
                    })()}</p>
                  </div>
                  <div>סה״כ שורה
                    <p className="mt-2 text-lg font-extrabold text-v2-primary-dark">{lineTotal === null ? '—' : ils.format(lineTotal)}</p>
                  </div>
                </div>
              </article>
            );
          })}
          <button type="button" className="w-full h-12 rounded-2xl border border-dashed border-v2-primary text-v2-primary font-bold" onClick={() => searchRef.current?.querySelector('input')?.focus()}>+ הוספת מידה נוספת</button>
        </section>
      </div>

      <div className="mt-4 rounded-[18px] border border-v2-border bg-v2-surface shadow-[var(--v2-shadow)] p-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex-1 text-sm font-semibold">הערה
          <textarea className="mt-1 w-full min-h-16 rounded-v2-control border border-v2-border p-2 font-normal" maxLength={500} placeholder="הערה לעסקה" value={draft.notes} onChange={(event) => setDraftNotes(businessId, event.target.value)} />
        </label>
        <div className="flex flex-col gap-2 lg:w-64">
          {quote.unknownCostLines > 0 && <p className="text-sm text-v2-red">{UNKNOWN_COST_SALE_MESSAGE}</p>}
          <button type="button" className={`${v2Button.primary} w-full`} disabled={!QUICK_SALE_PERSISTENCE_READY || saving || draft.lines.length === 0 || quote.missingPriceLines > 0 || !quote.costComplete || !draft.salespersonEmployeeId} onClick={confirmSale}>{saving ? 'שומר…' : 'אישור מכירה'}</button>
          <button type="button" className={v2Button.secondary} onClick={() => clearSaleDraft(businessId)}>ניקוי טיוטה</button>
          <button
            type="button"
            className={v2Button.secondary}
            disabled={!QUICK_SALE_PERSISTENCE_READY || reversing || !savedId}
            onClick={async () => {
              if (!QUICK_SALE_PERSISTENCE_READY || !savedId || reversing) return;
              setReversing(true);
              setSaveError(null);
              try {
                const result = await reverseQuickSale(businessId, savedId);
                setSaveError(result.replayed ? 'העסקה כבר בוטלה. המלאי לא שונה שוב.' : 'העסקה בוטלה והמלאי הוחזר.');
                setSavedId(null);
              } catch (error) {
                setSaveError(error instanceof Error ? error.message : 'הביטול נכשל. המלאי לא שונה.');
              } finally {
                setReversing(false);
              }
            }}
          >{reversing ? 'מבטל…' : 'ביטול העסקה האחרונה'}</button>
          <p className="text-xs text-v2-muted">{QUICK_SALE_PERSISTENCE_READY ? 'השמירה האטומית פעילה.' : 'האישור חסום עד להפעלת השמירה האטומית. הטיוטה לא נרשמת ולא מורידה מלאי.'}</p>
          {!QUICK_SALE_PERSISTENCE_READY && <p className="text-xs text-v2-muted">ביטול מכירה מהירה כבוי. המלאי לא ישתנה.</p>}
          {savedId && !saveError && <p className="text-xs text-v2-green font-semibold">העסקה נשמרה. <Bidi>{savedId}</Bidi></p>}
          {savedId && saveError && <p className="text-xs text-v2-navy font-semibold">{saveError}</p>}
          {!savedId && saveError && <p className="text-xs text-v2-red font-semibold">{saveError}</p>}
        </div>
      </div>
    </div>
  );
};

const SummaryRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-v2-muted">{label}</span>
    <bdi className={strong ? 'font-extrabold' : 'font-bold'}>{value}</bdi>
  </div>
);
