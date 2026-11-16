import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Box, Calendar, Check, ClipboardList, Coins, Info, Loader2, Plus, Search, Ship, Trash2, User,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCreateImportOrder } from '@/hooks/useImportOrders';
import {
  ORDER_CURRENCIES,
  PURCHASE_TYPES,
  PURCHASE_TYPE_LABELS,
  NEW_PRODUCT_BLOCKED,
  WIZARD_NOTICE,
  advance,
  buildOrderPayload,
  catalogMessage,
  claimSubmit,
  creationResult,
  emptyDraft,
  emptyLine,
  formatOrderMoney,
  isDraftDirty,
  retreat,
  serviceSizeLabel,
  submissionMessage,
  supplierMessage,
  tireSizeLabel,
  wizardTotals,
  type WizardDraft,
  type WizardLine,
  type WizardStep,
} from '@/lib/v2/importOrderWizard';
import { todayIso } from '@/lib/v2/importDashboardMetrics';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProductHit {
  id: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
  modelName: string | null;
  sizeLabel: string | null;
  supplierSku: string | null;
  detailNote: string | null;
}

const STEPS = [
  { step: 1 as WizardStep, title: 'פרטי הזמנה', hint: 'הגדרת הבסיס של ההזמנה' },
  { step: 2 as WizardStep, title: 'מוצרים', hint: 'הוספת הצמיגים והכמויות' },
  { step: 3 as WizardStep, title: 'סיכום ויצירה', hint: 'בדיקת הנתונים ופתיחת ההזמנה' },
];

const navy = 'text-[hsl(var(--v2-navy))]';
const green = 'bg-[hsl(var(--v2-green))] text-white hover:bg-[hsl(141_90%_24%)]';
const field = 'h-11 rounded-xl border-[hsl(var(--v2-border))] bg-white text-[hsl(var(--v2-navy))]';

export const CreateImportWizard: React.FC<Props> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { activeBusinessId } = useActiveBusiness();
  const { suppliers = [], isLoading: suppliersLoading, error: suppliersError } = useSuppliers('import');
  const createOrder = useCreateImportOrder();
  const seeded = useRef<WizardDraft | null>(null);
  if (!seeded.current) seeded.current = emptyDraft(todayIso(), crypto.randomUUID());
  const [draft, setDraft] = useState<WizardDraft>(seeded.current);
  const [initial, setInitial] = useState<WizardDraft>(seeded.current);
  const [step, setStep] = useState<WizardStep>(1);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [catalogNote, setCatalogNote] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!open) return;
    const next = emptyDraft(todayIso(), crypto.randomUUID());
    setDraft(next);
    setInitial(next);
    setStep(1);
    setErrors([]);
    setConfirming(false);
    setSubmitError(null);
    setCatalogNote(null);
    inFlight.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || step !== 2 || !activeBusinessId) return;
    let cancelled = false;
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', activeBusinessId)
      .then(({ count, error }) => {
        if (cancelled) return;
        setCatalogNote(catalogMessage(error ? null : count ?? 0, !!error));
      });
    return () => { cancelled = true; };
  }, [open, step, activeBusinessId]);

  const requestClose = () => {
    if (createOrder.isPending) return;
    if (isDraftDirty(draft, initial)) {
      setConfirming(true);
      return;
    }
    onOpenChange(false);
  };

  const goNext = () => {
    const result = advance(draft, step);
    setErrors(result.errors);
    if (result.step === 2 && step === 1 && draft.lines.length === 0) {
      setDraft({ ...draft, lines: [emptyLine(crypto.randomUUID())] });
    }
    setStep(result.step);
  };

  const submit = async () => {
    const claim = claimSubmit(inFlight.current || createOrder.isPending);
    if (!claim.ok) return;
    const built = buildOrderPayload(draft);
    if (built.ok === false) {
      setErrors(built.errors);
      setSubmitError(null);
      return;
    }
    inFlight.current = true;
    setSubmitError(null);
    try {
      const data = await createOrder.mutateAsync(built.payload);
      const outcome = creationResult({ ok: true, id: data?.id });
      if (!outcome.success || !outcome.navigateTo) {
        setSubmitError('ההזמנה לא נפתחה, כי השרת לא החזיר מזהה רשומה.');
        return;
      }
      onOpenChange(false);
      navigate(outcome.navigateTo);
    } catch (error) {
      setSubmitError(submissionMessage(error as { message?: string }));
    } finally {
      inFlight.current = false;
    }
  };

  const supplierName = suppliers.find((supplier) => supplier.id === draft.supplierId)?.name ?? '';
  const supplierNote = supplierMessage(
    suppliersError ? null : suppliers.length,
    !!suppliersError,
    suppliersError instanceof Error ? suppliersError.message : '',
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose(); }}>
      <DialogContent
        className="flex h-[min(92vh,900px)] w-[min(1120px,calc(100%-1rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl [&>button]:left-4 [&>button]:right-auto"
        dir="rtl"
      >
        <DialogDescription className="sr-only">אשף יצירת הזמנת יבוא בשלושה שלבים. לא נשמר דבר עד ליצירת ההזמנה.</DialogDescription>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--v2-green-soft))] text-[hsl(var(--v2-green))]">
              <Ship className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <DialogTitle className={`text-2xl font-bold ${navy}`}>הזמנת יבוא חדשה</DialogTitle>
          </div>
        </div>

        <div className="border-b px-5 py-4">
          <ol className="flex items-start justify-between gap-2" aria-label="שלבי האשף">
            {STEPS.map((item, index) => {
              const done = step > item.step;
              const current = step === item.step;
              return (
                <li key={item.step} className="flex min-w-0 flex-1 items-start">
                  <div className="flex min-w-0 flex-col items-center text-center">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${done || current ? 'bg-[hsl(var(--v2-green))] text-white' : 'border border-[hsl(215_16%_80%)] bg-white text-[hsl(var(--v2-muted))]'}`}>
                      {done ? <Check className="h-4 w-4" /> : item.step}
                    </span>
                    <span className={`mt-1 text-xs sm:text-sm ${current ? 'font-semibold text-[hsl(var(--v2-green))]' : navy}`}>{item.title}</span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <span className={`mx-2 mt-4 h-0.5 flex-1 ${step > item.step ? 'bg-[hsl(var(--v2-green))]' : 'bg-[hsl(215_16%_86%)]'}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden border-l bg-[hsl(var(--v2-green-soft))]/50 p-4 lg:block">
            <p className={`mb-3 flex items-center gap-1 text-sm font-semibold ${navy}`}><Info className="h-4 w-4" /> על התהליך</p>
            <ol className="space-y-3">
              {STEPS.map((item) => (
                <li key={item.step} className={step === item.step ? 'text-[hsl(var(--v2-green))]' : navy}>
                  <p className="text-sm font-semibold">{item.step}. {item.title}</p>
                  <p className="text-xs text-[hsl(var(--v2-muted))]">{item.hint}</p>
                </li>
              ))}
            </ol>
          </aside>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
            {errors.length > 0 && (
              <div role="alert" className="mb-3 rounded-xl border border-[hsl(var(--v2-red))]/30 bg-[hsl(var(--v2-red-soft))] p-3 text-sm text-[hsl(var(--v2-red))]">
                {errors.map((error) => <p key={error}>{error}</p>)}
              </div>
            )}

            {step === 1 && (
              <section className="rounded-2xl border border-[hsl(var(--v2-border))] p-4">
                <h3 className={`mb-4 flex items-center gap-2 font-semibold ${navy}`}><ClipboardList className="h-4 w-4" /> פרטי הזמנה כלליים</h3>
                {suppliersLoading && <p className="mb-3 text-sm">טוען ספקים…</p>}
                {supplierNote && <p role="alert" className="mb-3 text-sm text-[hsl(var(--v2-red))]">{supplierNote}</p>}
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button type="button" variant={draft.supplierMode === 'existing' ? 'default' : 'outline'} className={draft.supplierMode === 'existing' ? green : 'rounded-xl'} onClick={() => setDraft({ ...draft, supplierMode: 'existing' })}>ספק קיים</Button>
                  <Button type="button" variant={draft.supplierMode === 'new' ? 'default' : 'outline'} className={draft.supplierMode === 'new' ? green : 'rounded-xl'} onClick={() => setDraft({ ...draft, supplierMode: 'new' })}>+ הוספת ספק יבוא</Button>
                </div>
                <p className="mb-3 text-xs text-[hsl(var(--v2-muted))]">הרשימה מציגה ספקי יבוא בלבד. ספק חדש נשמר כיבוא בלבד, ואם כבר קיים ספק באותו שם ומדינה הוא יסומן גם ליבוא בלי להימחק מהרכש המקומי.</p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {draft.supplierMode === 'existing' ? (
                  <Field label="ספק" required>
                    <Select value={draft.supplierId || undefined} onValueChange={(value) => setDraft({ ...draft, supplierId: value })}>
                      <SelectTrigger className={field}><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  ) : (
                    <>
                      <Field label="שם ספק" required><Input className={field} value={draft.newSupplierName} onChange={(event) => setDraft({ ...draft, newSupplierName: event.target.value })} /></Field>
                      <Field label="מדינה" required><Input className={field} value={draft.newSupplierCountry} onChange={(event) => setDraft({ ...draft, newSupplierCountry: event.target.value })} /></Field>
                      <Field label="איש קשר"><Input className={field} value={draft.newSupplierContact} onChange={(event) => setDraft({ ...draft, newSupplierContact: event.target.value })} /></Field>
                      <Field label="טלפון"><Input className={field} value={draft.newSupplierPhone} onChange={(event) => setDraft({ ...draft, newSupplierPhone: event.target.value })} /></Field>
                      <Field label="דוא״ל"><Input className={field} value={draft.newSupplierEmail} onChange={(event) => setDraft({ ...draft, newSupplierEmail: event.target.value })} /></Field>
                    </>
                  )}
                  <Field label="סוג רכישה" required>
                    <Select value={draft.purchaseType || undefined} onValueChange={(value) => setDraft({ ...draft, purchaseType: value })}>
                      <SelectTrigger className={field}><SelectValue placeholder="בחר סוג" /></SelectTrigger>
                      <SelectContent>
                        {PURCHASE_TYPES.map((value) => <SelectItem key={value} value={value}>{PURCHASE_TYPE_LABELS[value]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="מטבע" required>
                    <Select value={draft.currency || undefined} onValueChange={(value) => setDraft({ ...draft, currency: value })}>
                      <SelectTrigger className={field}><SelectValue placeholder="בחר מטבע" /></SelectTrigger>
                      <SelectContent>
                        {ORDER_CURRENCIES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="שער עבודה לש״ח">
                    <Input className={field} inputMode="decimal" value={draft.rate} onChange={(event) => setDraft({ ...draft, rate: event.target.value })} placeholder="לדוגמה 3.7" />
                  </Field>
                  <Field label="תאריך הזמנה" required>
                    <Input className={field} type="date" value={draft.orderDate} onChange={(event) => setDraft({ ...draft, orderDate: event.target.value })} required />
                  </Field>
                  <Field label="צפי הגעה משוער">
                    <Input className={field} type="date" value={draft.eta} onChange={(event) => setDraft({ ...draft, eta: event.target.value })} />
                  </Field>
                  <Field label="מספר אסמכתא אצל הספק" className="xl:col-span-2">
                    <Input className={field} value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} />
                  </Field>
                </div>
                <div className="mt-3">
                  <Label htmlFor="import-notes">הערות</Label>
                  <Textarea id="import-notes" className="mt-1 rounded-xl border-[hsl(var(--v2-border))]" rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`flex items-center gap-2 font-semibold ${navy}`}><Box className="h-4 w-4" /> מוצרים בהזמנה</h3>
                </div>
                <p className="text-xs text-[hsl(var(--v2-muted))]">{NEW_PRODUCT_BLOCKED}</p>
                {catalogNote && <p role="alert" className="text-sm text-[hsl(var(--v2-red))]">{catalogNote}</p>}
                <div className="space-y-3">
                  {draft.lines.map((line, index) => (
                    <ProductRow
                      key={line.key}
                      line={line}
                      index={index}
                      businessId={activeBusinessId}
                      supplierId={draft.supplierId}
                      currency={draft.currency}
                      onChange={(next) => setDraft({ ...draft, lines: draft.lines.map((item) => item.key === line.key ? next : item) })}
                      onRemove={() => setDraft({ ...draft, lines: draft.lines.filter((item) => item.key !== line.key) })}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-[hsl(var(--v2-green))] text-[hsl(var(--v2-green))]"
                  onClick={() => setDraft({ ...draft, lines: [...draft.lines, emptyLine(crypto.randomUUID())] })}
                  disabled={!!catalogNote}
                >
                  <Plus className="h-4 w-4" />
                  הוספת מוצר נוסף
                </Button>
                <Totals currency={draft.currency} lines={draft.lines} />
              </section>
            )}

            {step === 3 && (
              <section className="space-y-4">
                <div className="rounded-2xl border border-[hsl(var(--v2-border))] p-4">
                  <h3 className={`mb-3 flex items-center gap-2 font-semibold ${navy}`}><ClipboardList className="h-4 w-4" /> פרטי הזמנה</h3>
                  <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryItem icon={<User className="h-4 w-4" />} label="ספק" value={draft.supplierMode === 'new' ? draft.newSupplierName || 'ספק חדש' : supplierName || 'לא נבחר'} />
                    <SummaryItem label="סוג רכישה" value={PURCHASE_TYPE_LABELS[draft.purchaseType as keyof typeof PURCHASE_TYPE_LABELS] ?? draft.purchaseType} />
                    <SummaryItem label="מטבע" value={draft.currency} />
                    <SummaryItem label="שער עבודה לש״ח" value={draft.rate.trim() || 'לא הוזן'} />
                    <SummaryItem icon={<Calendar className="h-4 w-4" />} label="תאריך הזמנה" value={draft.orderDate} />
                    <SummaryItem label="צפי הגעה" value={draft.eta || 'לא הוזן'} />
                    <SummaryItem label="אסמכתא" value={draft.reference.trim() || 'לא הוזנה'} />
                  </dl>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--v2-border))]">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-[hsl(var(--v2-table-head))] text-[hsl(var(--v2-muted))]">
                      <tr>
                        {['מוצר', 'מידה', 'כמות', 'מחיר ספק', `סה״כ (${draft.currency})`].map((heading) => (
                          <th key={heading} className="px-3 py-2 text-right font-medium">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {draft.lines.map((line) => (
                        <tr key={line.key} className="border-t">
                          <td className="px-3 py-2">{line.definition === 'new' ? [line.brandName, line.modelName].filter(Boolean).join(' ') : [line.brandName, line.modelName, line.productName].filter(Boolean).join(' · ')}</td>
                          <td className="px-3 py-2">
                            <div>{line.definition === 'new' ? serviceSizeLabel(line.width, line.aspect, line.rim, line.loadIndex, line.speedRating) : line.sizeLabel || 'לא נשמרה'}</div>
                            {(line.loadIndex.trim() || line.speedRating.trim()) && (
                              <div className="text-xs text-[hsl(var(--v2-muted))]">קוד עומס {line.loadIndex.trim()} · קוד מהירות {line.speedRating.trim().toUpperCase() || 'לא הוזן'}</div>
                            )}
                          </td>
                          <td className="px-3 py-2">{line.quantity}</td>
                          <td className="px-3 py-2">{formatOrderMoney(Number(line.unitPrice) || 0, draft.currency)}</td>
                          <td className="px-3 py-2">{formatOrderMoney((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), draft.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Totals currency={draft.currency} lines={draft.lines} />
                <p className="flex gap-2 rounded-xl border border-[hsl(var(--v2-blue))]/20 bg-[hsl(var(--v2-blue-soft))] p-3 text-sm text-[hsl(var(--v2-navy))]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--v2-blue))]" />
                  {WIZARD_NOTICE}
                </p>
                {submitError && <p role="alert" className="text-sm text-[hsl(var(--v2-red))]">{submitError}</p>}
              </section>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-4">
          <div>
            {step === 1 ? (
              <Button type="button" variant="outline" className="rounded-xl" onClick={requestClose}>ביטול</Button>
            ) : (
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setErrors([]); setStep(retreat(step)); }}>
                <ArrowRight className="h-4 w-4" />
                {step === 2 ? 'חזרה לפרטים' : 'חזרה'}
              </Button>
            )}
          </div>
          {step < 3 ? (
            <Button type="button" className={`rounded-xl ${green}`} onClick={goNext}>
              {step === 1 ? 'המשך למוצרים' : 'המשך לסיכום ויצירה'}
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" className={`rounded-xl ${green}`} onClick={submit} disabled={createOrder.isPending}>
              {createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              יצירת הזמנה
            </Button>
          )}
        </div>

        {confirming && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 p-6" role="alertdialog" aria-label="סגירה בלי שמירה">
            <div className="max-w-sm space-y-3 rounded-2xl border bg-white p-5 text-center shadow-[var(--v2-shadow)]">
              <p className={`font-semibold ${navy}`}>לסגור בלי ליצור הזמנה?</p>
              <p className="text-sm text-[hsl(var(--v2-muted))]">הפרטים שהוזנו יימחקו. לא נשמר דבר במסד.</p>
              <div className="flex justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirming(false)}>המשך עריכה</Button>
                <Button type="button" className={green} onClick={() => onOpenChange(false)}>סגור בלי לשמור</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Field: React.FC<{ label: string; required?: boolean; className?: string; children: React.ReactNode }> = ({ label, required, className, children }) => (
  <div className={className}>
    <Label className="mb-1 flex items-center gap-1 text-[hsl(var(--v2-navy))]">
      {label}
      {required && <span className="text-[hsl(var(--v2-red))]">*</span>}
    </Label>
    {children}
  </div>
);

const SummaryItem: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div>
    <dt className="flex items-center gap-1 text-xs text-[hsl(var(--v2-muted))]">{icon}{label}</dt>
    <dd className="font-semibold text-[hsl(var(--v2-navy))]">{value}</dd>
  </div>
);

const Totals: React.FC<{ lines: WizardLine[]; currency: string }> = ({ lines, currency }) => {
  const totals = wizardTotals(lines);
  return (
    <div className="grid gap-2 rounded-2xl bg-[hsl(var(--v2-green-soft))] p-3 sm:grid-cols-3">
      <Total icon={<Box className="h-4 w-4" />} label="מספר שורות" value={String(totals.lineCount)} />
      <Total icon={<Coins className="h-4 w-4" />} label="סה״כ צמיגים" value={totals.quantity.toLocaleString('he-IL')} />
      <Total icon={<Coins className="h-4 w-4" />} label="שווי סחורה" value={currency ? formatOrderMoney(totals.value, currency) : '—'} />
    </div>
  );
};

const Total: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="text-center sm:text-right">
    <p className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--v2-muted))] sm:justify-start">{icon}{label}</p>
    <p className="text-lg font-bold text-[hsl(var(--v2-green))]">{value}</p>
  </div>
);

const ProductRow: React.FC<{
  line: WizardLine;
  index: number;
  businessId: string | null;
  supplierId: string;
  currency: string;
  onChange: (line: WizardLine) => void;
  onRemove: () => void;
}> = ({ line, index, businessId, supplierId, currency, onChange, onRemove }) => {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    const query = term.trim();
    if (!businessId) {
      setSearchError('אין הקשר עסק מורשה לחיפוש.');
      return;
    }
    if (query.length < 2) {
      setHits([]);
      setSearchError('הקלד לפחות שני תווים לחיפוש בקטלוג.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchCatalog(businessId, supplierId, query);
      setHits(found);
      setSearchError(found.length === 0 ? 'אין מוצרים תואמים בקטלוג.' : null);
    } catch {
      setHits([]);
      setSearchError('חיפוש המוצרים נכשל. לא מוצגת רשימה חלופית.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <article className="rounded-2xl border border-[hsl(var(--v2-border))] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[hsl(var(--v2-navy))]">שורה {index + 1}</p>
          <Button type="button" size="sm" variant={line.definition === 'existing' ? 'default' : 'outline'} className={line.definition === 'existing' ? green : ''} onClick={() => onChange({ ...line, definition: 'existing' })}>בחירת צמיג קיים</Button>
          <Button type="button" size="sm" variant={line.definition === 'new' ? 'default' : 'outline'} className={line.definition === 'new' ? green : ''} onClick={() => onChange({ ...line, definition: 'new', productId: '' })}>הגדרת צמיג חדש</Button>
          <Button type="button" variant="ghost" size="icon" className="mr-auto" aria-label={`הסרת שורה ${index + 1}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-[hsl(var(--v2-red))]" />
          </Button>
        </div>
        {line.definition === 'new' ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="יצרן / מותג" required><Input className={field} value={line.brandName ?? ''} onChange={(event) => onChange({ ...line, brandName: event.target.value })} /></Field>
            <Field label="דגם" required><Input className={field} value={line.modelName ?? ''} onChange={(event) => onChange({ ...line, modelName: event.target.value })} /></Field>
            <Field label="רוחב" required><Input className={field} inputMode="numeric" value={line.width} onChange={(event) => onChange({ ...line, width: event.target.value })} /></Field>
            <Field label="חתך" required><Input className={field} inputMode="numeric" value={line.aspect} onChange={(event) => onChange({ ...line, aspect: event.target.value })} /></Field>
            <Field label="קוטר חישוק" required><Input className={field} inputMode="decimal" value={line.rim} onChange={(event) => onChange({ ...line, rim: event.target.value })} /></Field>
            <Field label="קוד עומס" required><Input className={field} inputMode="numeric" value={line.loadIndex} onChange={(event) => onChange({ ...line, loadIndex: event.target.value })} /></Field>
            <Field label="קוד מהירות"><Input className={field} value={line.speedRating} onChange={(event) => onChange({ ...line, speedRating: event.target.value })} /></Field>
            <Field label="מק״ט"><Input className={field} value={line.supplierSku ?? ''} onChange={(event) => onChange({ ...line, supplierSku: event.target.value })} /></Field>
            <Field label="כמות" required><Input className={field} inputMode="numeric" value={line.quantity} onChange={(event) => onChange({ ...line, quantity: event.target.value })} /></Field>
            <Field label={`מחיר ספק${currency ? ` (${currency})` : ''}`} required><Input className={field} inputMode="decimal" value={line.unitPrice} onChange={(event) => onChange({ ...line, unitPrice: event.target.value })} /></Field>
            <Field label="מחיר מכירה מתוכנן (ש״ח)"><Input className={field} inputMode="decimal" value={line.plannedSale} onChange={(event) => onChange({ ...line, plannedSale: event.target.value })} /></Field>
          </div>
        ) : (
        <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--v2-muted))]" />
          <Input
            className={`${field} pr-9`}
            value={term}
            placeholder="חיפוש מוצר קיים לפי שם"
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }}
          />
        </div>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => void search()} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'חיפוש'}
        </Button>
      </div>
      {searchError && <p role="status" className="mt-1 text-xs text-[hsl(var(--v2-muted))]">{searchError}</p>}
      {hits.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-auto rounded-xl border">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-right text-sm hover:bg-[hsl(var(--v2-green-soft))]"
                onClick={() => {
                  onChange({
                    ...line,
                    productId: hit.id,
                    brandId: hit.brandId,
                    brandName: hit.brandName,
                    modelName: hit.modelName,
                    sizeLabel: hit.sizeLabel,
                    productName: hit.name,
                    supplierSku: hit.supplierSku,
                    detailNote: hit.detailNote,
                    unitPrice: '',
                    plannedSale: '',
                  });
                  setHits([]);
                  setTerm(hit.name);
                }}
              >
                {[hit.brandName, hit.modelName || hit.name, hit.sizeLabel].filter(Boolean).join(' · ')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <Readout label="מותג" value={line.brandName || (line.productId ? 'לא נשמר' : '—')} />
        <Readout label="דגם" value={line.modelName || (line.productId ? line.productName : '—')} />
        <Readout label="מידה" value={line.sizeLabel || (line.productId ? 'לא נשמרה' : '—')} />
        <Field label="כמות" required>
          <Input className={field} inputMode="numeric" value={line.quantity} onChange={(event) => onChange({ ...line, quantity: event.target.value })} />
        </Field>
        <Field label={`מחיר ספק${currency ? ` (${currency})` : ''}`} required>
          <Input className={field} inputMode="decimal" value={line.unitPrice} onChange={(event) => onChange({ ...line, unitPrice: event.target.value })} />
        </Field>
        <Field label="מחיר מכירה מתוכנן (ש״ח)">
          <Input className={field} inputMode="decimal" value={line.plannedSale} onChange={(event) => onChange({ ...line, plannedSale: event.target.value })} />
        </Field>
      </div>
      {line.detailNote && <p className="mt-2 text-xs text-[hsl(var(--v2-muted))]">{line.detailNote}</p>}
        </>
        )}
    </article>
  );
};

const Readout: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="mb-1 text-sm text-[hsl(var(--v2-navy))]">{label}</p>
    <p className="flex h-11 items-center rounded-xl border border-[hsl(var(--v2-border))] bg-[hsl(210_40%_98%)] px-3 text-sm">{value}</p>
  </div>
);

async function searchCatalog(businessId: string, supplierId: string, term: string): Promise<ProductHit[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand_id, brands(name)')
    .eq('business_id', businessId)
    .ilike('name', `%${term.replace(/[%_,]/g, ' ')}%`)
    .limit(12);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((row) => row.id);
  const client = supabase as unknown as { from: (table: string) => { select: (query: string) => any } };
  let specs: Array<Record<string, unknown>> = [];
  let skus: Array<Record<string, unknown>> = [];
  if (ids.length > 0) {
    const specQuery = client.from('product_tire_specs').select('product_id, model_name, width_mm, aspect_ratio, rim_inch, load_index, speed_rating, extra_marks').in('product_id', ids).eq('business_id', businessId);
    const skuQuery = supplierId
      ? client.from('product_supplier_skus').select('product_id, supplier_sku').in('product_id', ids).eq('business_id', businessId).eq('supplier_id', supplierId)
      : Promise.resolve({ data: [], error: null });
    const [specRes, skuRes] = await Promise.all([specQuery, skuQuery]);
    if (!specRes.error) specs = specRes.data ?? [];
    if (!skuRes.error) skus = skuRes.data ?? [];
  }
  return rows.map((row) => {
    const spec = specs.find((item) => item.product_id === row.id) ?? null;
    const sku = skus.find((item) => item.product_id === row.id);
    const brand = brandName(row.brands);
    const size = tireSizeLabel(spec);
    const marks = Array.isArray(spec?.extra_marks) ? spec.extra_marks.filter((mark): mark is string => typeof mark === 'string') : [];
    const notes = [
      size ? null : 'מידה לא נשמרה במפרט',
      spec?.model_name ? null : 'דגם לא נשמר במפרט',
      marks.length ? `סימונים שמורים: ${marks.join(', ')}` : null,
    ].filter(Boolean);
    return {
      id: row.id,
      name: row.name,
      brandId: row.brand_id,
      brandName: brand,
      modelName: typeof spec?.model_name === 'string' ? spec.model_name : null,
      sizeLabel: size,
      supplierSku: typeof sku?.supplier_sku === 'string' ? sku.supplier_sku : null,
      detailNote: notes.length ? notes.join(' · ') : null,
    };
  });
}

function brandName(value: unknown): string | null {
  if (Array.isArray(value)) return brandName(value[0]);
  if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string') return value.name;
  return null;
}
