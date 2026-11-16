import { lineTotal } from '@/lib/v2/purchaseOrder';
import { SUPPLIER_RETURN_RESERVATION_READY } from '@/lib/v2/inventoryFlags';

/** Labels for a return document. They are not purchase-order statuses. */
export const RETURN_STATUS_LABEL = {
  reserved: 'שריון להחזרה',
  dispatched: 'במסירה לספק',
  awaiting_credit: 'ממתין לזיכוי',
  credited: 'זוכה',
} as const;

export type ReturnStatus = keyof typeof RETURN_STATUS_LABEL;

export const RETURN_REASONS = [
  { id: 'defect', label: 'פגם ייצור' },
  { id: 'wrong_product', label: 'מוצר שגוי' },
  { id: 'agreement', label: 'הסכם עם הספק' },
  { id: 'other', label: 'אחר' },
] as const;

export type ReturnReasonId = (typeof RETURN_REASONS)[number]['id'];

export const RESERVATION_CLOSED = 'שריון המלאי כבוי. המלאי הפיזי והכמות הזמינה למכירה הם אותו מספר, ולכן שריון היה מוריד מהמלאי. שום כמות לא השתנתה.';
export const DISPATCH_CLOSED = 'מסירה לספק עדיין כבויה. אישור המסירה לא נשלח, והמלאי לא השתנה.';
export const DISPATCH_CONFIRMATION = 'אני מאשר שהסחורה נמסרה פיזית לספק וניתן להפחית אותה מהמלאי.';
export const CREDIT_NOT_A_STOCK_EXIT = 'זיכוי ספק אינו נרשם במסירה. יציאת המלאי אינה זיכוי, תשלום או הכנסה.';
export const CREDIT_CLOSED = 'זיכוי ספק כבוי. לא נרשם זיכוי ולא שונה תשלום או מחזור מכירות.';
export const LEDGER_UNAVAILABLE = 'ספר ההחזרות אינו זמין. אין כאן מסירה שמורה, וזה אינו מצב של אפס החזרות.';

export interface ReturnDraftLine {
  productId: string;
  quantity: number;
  /** Current catalog cost copied into the draft. Editing it does not write products.cost. */
  unitCost: number | null;
  onHand: number;
}

export function returnQuantityValid(quantity: number, onHand: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && Number.isInteger(onHand) && onHand >= quantity;
}

export function returnDraftIssues(input: {
  supplierId: string | null;
  reasonId: ReturnReasonId | '';
  lines: ReturnDraftLine[];
}): string[] {
  const issues: string[] = [];
  if (!input.supplierId) issues.push('יש לבחור ספק קיים.');
  if (!input.reasonId) issues.push('יש לבחור סיבת החזרה.');
  if (input.lines.length === 0) issues.push('יש להוסיף לפחות מוצר אחד.');
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (seen.has(line.productId)) issues.push('אותו מוצר מופיע פעמיים בהחזרה.');
    seen.add(line.productId);
    if (!returnQuantityValid(line.quantity, line.onHand)) issues.push('כמות ההחזרה גדולה מהכמות שבמלאי.');
    if (line.unitCost !== null && (!Number.isFinite(line.unitCost) || line.unitCost < 0)) issues.push('עלות היחידה אינה תקינה.');
  }
  return issues;
}

/** Sum of quantity × edited unit cost. Unknown cost keeps the total unknown. */
export function returnDraftTotal(lines: Array<Pick<ReturnDraftLine, 'quantity' | 'unitCost'>>): number | null {
  if (lines.length === 0) return null;
  let sum = 0;
  for (const line of lines) {
    const total = lineTotal(line.quantity, line.unitCost);
    if (total === null) return null;
    sum += total;
  }
  return sum;
}

/** Reservation, dispatch and credit stay refused. The draft is not a stock write. */
export function supplierReturnPostingClosed(): { reservation: string; dispatch: string; credit: string } | null {
  if (SUPPLIER_RETURN_RESERVATION_READY) return null;
  return { reservation: RESERVATION_CLOSED, dispatch: DISPATCH_CLOSED, credit: CREDIT_CLOSED };
}

/**
 * Stable identity of one dispatch request. Null cost and zero cost stay different.
 * The server recomputes its own payload; this only keeps the browser key stable.
 */
export function supplierReturnCanonical(input: {
  businessId: string;
  supplierId: string;
  reasonId: string;
  notes: string;
  lines: Array<{ productId: string; quantity: number; unitCost: number | null }>;
}): string {
  const lines = [...input.lines].sort((a, b) => a.productId.localeCompare(b.productId));
  const body = lines.map((line) => {
    const cost = line.unitCost === null ? 'null' : line.unitCost.toFixed(2);
    return `${line.productId}|${line.quantity}|${cost}`;
  }).join(';');
  return `${input.businessId}|${input.supplierId}|${input.reasonId}|${input.notes.trim()}|${body}`;
}
