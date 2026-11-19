import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { receiptPostingAvailable } from '@/lib/v2/goodsReceipt';

export interface PurchaseReceiptLine {
  lineId: string;
  quantity: number;
  /** Stored order cost. Null stays unknown. Zero stays zero. */
  agreedUnitCost: number | null;
}

export interface PostedPurchaseReceipt {
  id: string;
  replayed: boolean;
}

const readResult = (value: Json | null): PostedPurchaseReceipt | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = value.id;
  const replayed = value.replayed;
  if (typeof id !== 'string' || typeof replayed !== 'boolean') return null;
  return { id, replayed };
};

/** PostgREST returns a plain object, not an Error, unless throwOnError is used. */
export function receiptErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return '';
}

/**
 * Hebrew text for a failed receipt. The raw database message stays out of the UI.
 * Callers keep that message in the console for diagnosis.
 */
export function explainPurchaseReceiptError(message: string): string {
  if (message.includes('המלאי לא השתנה') || message.includes('המלאי לא הוגדל')) return message;
  const text = message.toLowerCase();
  if (text.includes('access denied') || text.includes('42501') || text.includes('permission denied')) {
    return 'אין הרשאה לקלוט את ההזמנה הזו. המלאי לא השתנה.';
  }
  if (text.includes('receiving employee')) return 'יש לבחור עובד קולט פעיל בעסק הזה. המלאי לא השתנה.';
  if (text.includes('order not found')) return 'ההזמנה לא נמצאה בעסק הזה. המלאי לא השתנה.';
  if (text.includes('order cannot be received')) return 'ההזמנה אינה פתוחה לקליטה. המלאי לא השתנה.';
  if (text.includes('quantity exceeds')) return 'אי אפשר לקלוט יותר מהיתרה הפתוחה. המלאי לא השתנה.';
  if (text.includes('invalid quantity')) return 'כמות הקליטה אינה תקינה. המלאי לא השתנה.';
  if (text.includes('cost difference')) return 'עלות הקליטה שונה מהמחיר שסוכם בהזמנה. המלאי לא השתנה.';
  if (text.includes('not one catalog product')) return 'השורה אינה מקושרת למוצר אחד במלאי. המלאי לא השתנה.';
  if (text.includes('supplier sku')) return 'מק״ט הספק שייך למוצר אחר. המלאי לא השתנה.';
  if (text.includes('product not found')) return 'המוצר אינו שייך לעסק הזה. המלאי לא השתנה.';
  if (text.includes('purchase_unit') || text.includes('check_purchase_data')) return 'לקליטה הזו חסרה עלות רכש. המלאי לא השתנה.';
  if (text.includes('does not exist') || text.includes('inventory_lots')) return 'קליטת המלאי אינה מוכנה במערכת. המלאי לא השתנה.';
  return 'הקליטה לא הושלמה. המלאי לא השתנה.';
}

/**
 * Posts one purchase-order receipt through post_purchase_receipt.
 * Refuses before any request while the order ledger or the receipt flag is off.
 * Sends the agreed cost as the actual cost, so a cost change is not invented here.
 */
export async function postPurchaseReceipt(input: {
  businessId: string;
  orderId: string;
  employeeId: string;
  idempotencyKey: string;
  updateCurrentCost: boolean;
  lines: PurchaseReceiptLine[];
}): Promise<PostedPurchaseReceipt> {
  if (!receiptPostingAvailable()) throw new Error('קליטת הרכש כבויה. המלאי לא השתנה.');
  if (!input.employeeId) throw new Error('יש לבחור עובד קולט לפני אישור הקליטה.');
  const lines = input.lines.filter((line) => line.quantity > 0);
  if (lines.length === 0) throw new Error('אין כמות לקליטה. המלאי לא השתנה.');
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error('כמות הקליטה אינה תקינה. המלאי לא השתנה.');
  }
  const { data, error } = await supabase.rpc('post_purchase_receipt', {
    p_business_id: input.businessId,
    p_order_id: input.orderId,
    p_idempotency_key: input.idempotencyKey,
    p_receiving_employee_id: input.employeeId,
    p_update_current_cost: input.updateCurrentCost,
    p_lines: lines.map((line) => ({
      line_id: line.lineId,
      quantity: line.quantity,
      actual_unit_cost: line.agreedUnitCost,
      cost_ack: false,
    })),
  });
  if (error) {
    const technical = receiptErrorText(error);
    console.error('post_purchase_receipt failed', technical);
    throw new Error(explainPurchaseReceiptError(technical));
  }
  const result = readResult(data);
  if (!result) throw new Error('הקליטה לא הושלמה. לא התקבל אישור מהשרת.');
  return result;
}
