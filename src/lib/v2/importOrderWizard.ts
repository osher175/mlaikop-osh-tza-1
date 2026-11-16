import { orderHref } from './importCenterNavigation.ts';

export const ORDER_CURRENCIES = ['ILS', 'USD', 'EUR', 'CNY', 'GBP', 'JPY', 'TRY'] as const;
export const PURCHASE_TYPES = ['direct_import', 'parallel_import'] as const;

export const PURCHASE_TYPE_LABELS: Record<(typeof PURCHASE_TYPES)[number], string> = {
  direct_import: 'יבוא ישיר',
  parallel_import: 'יבוא מקביל',
};

export const WIZARD_NOTICE =
  'יצירת ההזמנה פותחת הזמנת יבוא במערכת בלבד. הפעולה אינה קולטת סחורה, אינה משנה מלאי ואינה רושמת תשלום לספק.';

export const NEW_PRODUCT_BLOCKED =
  'צמיג חדש נשמר רק עם ההזמנה, בלי להגדיל מלאי. אם פונקציית השרת אינה מותקנת, לא נשמר דבר.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WizardStep = 1 | 2 | 3;

export interface WizardLine {
  key: string;
  productId: string;
  brandId: string | null;
  brandName: string | null;
  modelName: string | null;
  sizeLabel: string | null;
  productName: string;
  supplierSku: string | null;
  detailNote: string | null;
  definition: 'existing' | 'new';
  width: string;
  aspect: string;
  rim: string;
  loadIndex: string;
  speedRating: string;
  quantity: string;
  unitPrice: string;
  plannedSale: string;
}

export interface WizardDraft {
  supplierId: string;
  supplierMode: 'existing' | 'new';
  newSupplierName: string;
  newSupplierCountry: string;
  newSupplierContact: string;
  newSupplierPhone: string;
  newSupplierEmail: string;
  purchaseType: string;
  currency: string;
  rate: string;
  orderDate: string;
  eta: string;
  reference: string;
  notes: string;
  lines: WizardLine[];
  clientRequestId: string;
}

export interface WizardLinePayload {
  product_id: string | null;
  brand: string | null;
  model: string | null;
  width: number | null;
  aspect: number | null;
  rim: number | null;
  load_index: number | null;
  speed_rating: string | null;
  sku: string | null;
  size_label: string | null;
  description: string;
  ordered_quantity: number;
  supplier_unit_cost: number;
  planned_sale_price_ils: number | null;
}

export interface WizardOrderPayload {
  supplier_id: string | null;
  new_supplier: {
    name: string;
    country: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  purchase_type: 'direct_import' | 'parallel_import';
  currency_code: string;
  working_exchange_rate_to_ils: number | null;
  order_date: string;
  estimated_arrival_date: string | null;
  supplier_order_reference: string | null;
  notes: string | null;
  client_request_id: string;
  lines: WizardLinePayload[];
}

export function emptyDraft(today: string, clientRequestId = ''): WizardDraft {
  return {
    supplierId: '',
    supplierMode: 'existing',
    newSupplierName: '',
    newSupplierCountry: '',
    newSupplierContact: '',
    newSupplierPhone: '',
    newSupplierEmail: '',
    purchaseType: '',
    currency: '',
    rate: '',
    orderDate: today,
    eta: '',
    reference: '',
    notes: '',
    lines: [],
    clientRequestId,
  };
}

export function emptyLine(key: string): WizardLine {
  return {
    key,
    productId: '',
    brandId: null,
    brandName: null,
    modelName: null,
    sizeLabel: null,
    productName: '',
    supplierSku: null,
    detailNote: null,
    definition: 'existing',
    width: '',
    aspect: '',
    rim: '',
    loadIndex: '',
    speedRating: '',
    quantity: '1',
    unitPrice: '',
    plannedSale: '',
  };
}

export function isDraftDirty(draft: WizardDraft, initial: WizardDraft): boolean {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export function validateDetails(draft: WizardDraft): string[] {
  const errors: string[] = [];
  if (draft.supplierMode === 'new') {
    if (!draft.newSupplierName.trim()) errors.push('יש להזין שם ספק יבוא.');
    if (!draft.newSupplierCountry.trim()) errors.push('יש להזין מדינת ספק.');
  } else if (!draft.supplierId) {
    errors.push('יש לבחור ספק יבוא.');
  }
  if (!(PURCHASE_TYPES as readonly string[]).includes(draft.purchaseType)) errors.push('יש לבחור סוג רכישה.');
  if (!(ORDER_CURRENCIES as readonly string[]).includes(draft.currency)) errors.push('יש לבחור מטבע נתמך.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.orderDate)) errors.push('תאריך ההזמנה חסר או אינו תקין.');
  if (draft.eta && !/^\d{4}-\d{2}-\d{2}$/.test(draft.eta)) errors.push('תאריך ההגעה אינו תקין.');
  const rate = draft.rate.trim();
  if (rate) {
    const value = Number(rate);
    if (!Number.isFinite(value) || value <= 0) errors.push('שער העבודה חייב להיות מספר חיובי, או להישאר ריק.');
  }
  return errors;
}

export function validateLines(draft: WizardDraft): string[] {
  const errors: string[] = [];
  if (draft.lines.length === 0) errors.push('יש להוסיף לפחות שורת מוצר אחת.');
  const seen = new Set<string>();
  draft.lines.forEach((line, index) => {
    const label = `שורה ${index + 1}`;
    if (line.definition === 'new') {
      if (!line.brandName?.trim() || !line.modelName?.trim()) errors.push(`${label}: יש להזין יצרן ודגם.`);
      if (!positiveInt(line.width) || !positiveInt(line.aspect) || !positiveNumber(line.rim)) {
        errors.push(`${label}: יש להזין רוחב, חתך וקוטר חישוק.`);
      }
      if (!line.loadIndex.trim()) errors.push(`${label}: יש להזין קוד עומס.`);
      else if (!loadCode(line.loadIndex)) errors.push(`${label}: קוד העומס אינו תקין.`);
      if (line.speedRating.trim() && !/^[A-Za-z]{1,2}$/.test(line.speedRating.trim())) errors.push(`${label}: קוד המהירות אינו תקין.`);
    } else if (!line.productId) {
      errors.push(`${label}: יש לבחור מוצר קיים מהקטלוג.`);
      return;
    } else {
      if (seen.has(line.productId)) errors.push(`${label}: המוצר כבר נוסף. עדכן את הכמות בשורה הקיימת.`);
      seen.add(line.productId);
      if (!line.productName.trim()) errors.push(`${label}: למוצר אין שם שמור.`);
    }
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) errors.push(`${label}: הכמות חייבת להיות מספר שלם חיובי.`);
    if (line.unitPrice.trim() === '') errors.push(`${label}: יש להזין מחיר ספק.`);
    else {
      const price = Number(line.unitPrice);
      if (!Number.isFinite(price) || price < 0) errors.push(`${label}: מחיר הספק חייב להיות אפס או יותר.`);
    }
    if (line.plannedSale.trim()) {
      const sale = Number(line.plannedSale);
      if (!Number.isFinite(sale) || sale < 0) errors.push(`${label}: מחיר המכירה המתוכנן אינו תקין.`);
    }
  });
  return errors;
}

function positiveInt(value: string): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

/** Standard numeric load codes, including three-digit codes such as 101 and 104. */
export function loadCode(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[1-9][0-9]{0,2}$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return parsed >= 1 && parsed <= 279 ? parsed : null;
}

export function serviceSizeLabel(width: string, aspect: string, rim: string, load: string, speed: string): string {
  const size = `${width.trim()}/${aspect.trim()}R${rim.trim()}`;
  const mark = `${load.trim()}${speed.trim().toUpperCase()}`;
  return mark ? `${size} ${mark}` : size;
}

function positiveNumber(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function advance(draft: WizardDraft, step: WizardStep): { step: WizardStep; errors: string[] } {
  const errors = step === 1 ? validateDetails(draft) : step === 2 ? validateLines(draft) : [];
  if (errors.length > 0 || step === 3) return { step, errors };
  return { step: (step + 1) as WizardStep, errors: [] };
}

export function retreat(step: WizardStep): WizardStep {
  if (step === 3) return 2;
  return 1;
}

export function wizardTotals(lines: WizardLine[]) {
  return lines.reduce(
    (totals, line) => {
      const quantity = Number(line.quantity);
      const price = Number(line.unitPrice);
      const countable = Number.isInteger(quantity) && quantity > 0;
      const priced = line.unitPrice.trim() !== '' && Number.isFinite(price) && price >= 0;
      return {
        lineCount: totals.lineCount + (line.productId || line.definition === 'new' ? 1 : 0),
        quantity: totals.quantity + (countable ? quantity : 0),
        value: totals.value + (countable && priced ? quantity * price : 0),
      };
    },
    { lineCount: 0, quantity: 0, value: 0 },
  );
}

export function buildOrderPayload(draft: WizardDraft): { ok: true; payload: WizardOrderPayload } | { ok: false; errors: string[] } {
  const errors = [...validateDetails(draft), ...validateLines(draft)];
  if (errors.length > 0 || !UUID.test(draft.clientRequestId)) {
    if (!UUID.test(draft.clientRequestId)) errors.push('בקשת השמירה אינה תקינה.');
    return { ok: false, errors };
  }
  const rate = draft.rate.trim();
  return {
    ok: true,
    payload: {
      supplier_id: draft.supplierMode === 'new' ? null : draft.supplierId,
      new_supplier: draft.supplierMode === 'new' ? {
        name: draft.newSupplierName.trim(),
        country: draft.newSupplierCountry.trim(),
        contact_name: draft.newSupplierContact.trim() || null,
        phone: draft.newSupplierPhone.trim() || null,
        email: draft.newSupplierEmail.trim() || null,
      } : null,
      purchase_type: draft.purchaseType as WizardOrderPayload['purchase_type'],
      currency_code: draft.currency,
      working_exchange_rate_to_ils: rate ? Number(rate) : null,
      order_date: draft.orderDate,
      estimated_arrival_date: draft.eta || null,
      supplier_order_reference: draft.reference.trim() || null,
      notes: draft.notes.trim() || null,
      client_request_id: draft.clientRequestId,
      lines: draft.lines.map((line) => ({
        product_id: line.definition === 'new' ? null : line.productId,
        brand: line.brandName,
        model: line.modelName,
        width: line.definition === 'new' ? Number(line.width) : null,
        aspect: line.definition === 'new' ? Number(line.aspect) : null,
        rim: line.definition === 'new' ? Number(line.rim) : null,
        load_index: loadCode(line.loadIndex),
        speed_rating: line.speedRating.trim() ? line.speedRating.trim().toUpperCase() : null,
        sku: line.supplierSku,
        size_label: line.definition === 'new'
          ? serviceSizeLabel(line.width, line.aspect, line.rim, line.loadIndex, line.speedRating)
          : line.sizeLabel,
        description: line.definition === 'new'
          ? [line.brandName, line.modelName, serviceSizeLabel(line.width, line.aspect, line.rim, line.loadIndex, line.speedRating)].filter(Boolean).join(' ')
          : line.productName.trim(),
        ordered_quantity: Number(line.quantity),
        supplier_unit_cost: Number(line.unitPrice),
        planned_sale_price_ils: line.plannedSale.trim() ? Number(line.plannedSale) : null,
      })),
    },
  };
}

export function formatOrderMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
}

export function catalogMessage(count: number | null, failed: boolean): string | null {
  if (failed) return 'לא ניתן לטעון את קטלוג המוצרים. לא מוצגת רשימה חלופית.';
  if (count === 0) return 'אין מוצרים בקטלוג. יצירת מוצר חדש אינה זמינה במסך זה.';
  return null;
}

export function supplierMessage(count: number | null, failed: boolean, raw = ''): string | null {
  if (/serves_import|classification column/i.test(raw)) {
    return 'סיווג ספקי היבוא עדיין לא קיים במסד. הרשימה לא מוצגת.';
  }
  if (failed) return 'לא ניתן לטעון את הספקים. לא מוצגת רשימה חלופית.';
  if (count === 0) return 'אין ספקי יבוא עדיין. אפשר להוסיף ספק חדש.';
  return null;
}

export function claimSubmit(inFlight: boolean): { ok: boolean; inFlight: boolean } {
  if (inFlight) return { ok: false, inFlight: true };
  return { ok: true, inFlight: true };
}

export function creationResult(input: { ok: boolean; id?: string | null }): { success: boolean; navigateTo: string | null } {
  if (!input.ok || !input.id || !UUID.test(input.id)) return { success: false, navigateTo: null };
  return { success: true, navigateTo: orderHref(input.id) };
}

export function submissionMessage(error: { message?: string } | null): string {
  const raw = error?.message ?? '';
  if (/could not find the function|pgrst202|schema cache/i.test(raw)) {
    return 'שמירת ההזמנה המלאה ממתינה לאישור פונקציית השרת. לא נשמרה הזמנה חלקית ולא עודכן מלאי.';
  }
  if (/jwt|permission|row-level|42501|access denied/i.test(raw)) return 'אין הרשאה ליצור הזמנת יבוא.';
  if (/not available for import/i.test(raw)) return 'הספק אינו זמין ליבוא. ההזמנה לא נשמרה.';
  if (/not available for local/i.test(raw)) return 'הספק אינו זמין לרכש מקומי.';
  if (/Ambiguous supplier/i.test(raw)) return 'יש כמה ספקים עם אותו שם. ההזמנה לא נשמרה.';
  if (/different tire|Ambiguous tire/i.test(raw)) return 'ההתאמה לצמיג אינה חד-משמעית. בחרו את המוצר הקיים. לא נוצר מוצר חדש.';
  if (/already used/i.test(raw)) return 'בקשת השמירה כבר שייכת להזמנה אחרת. לא נפתחה הזמנה נוספת.';
  if (/failed to fetch|network|fetch/i.test(raw)) return 'אין חיבור לשרת. ההזמנה לא נשמרה.';
  if (/Supplier belongs/i.test(raw)) return 'הספק אינו שייך לעסק הזה.';
  if (/Product belongs/i.test(raw)) return 'אחד המוצרים אינו שייך לעסק הזה.';
  if (!raw) return 'ההזמנה לא נשמרה. לא נוצרה הזמנה חלקית.';
  return `ההזמנה לא נשמרה. ${raw}`;
}

/** Stored tire size only. Missing parts stay empty instead of being guessed from the product name. */
export function tireSizeLabel(spec: { width_mm?: unknown; aspect_ratio?: unknown; rim_inch?: unknown; load_index?: unknown; speed_rating?: unknown } | null): string | null {
  if (!spec) return null;
  const width = spec.width_mm;
  const aspect = spec.aspect_ratio;
  const rim = spec.rim_inch;
  if (width == null || aspect == null || rim == null) return null;
  const rating = [spec.load_index, spec.speed_rating].filter((part) => part != null && part !== '').join('');
  return rating ? `${width}/${aspect}R${rim} ${rating}` : `${width}/${aspect}R${rim}`;
}
