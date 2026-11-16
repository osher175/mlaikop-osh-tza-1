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
  if (error) throw error;
  const result = readResult(data);
  if (!result) throw new Error('הקליטה לא הושלמה. לא התקבל אישור מהשרת.');
  return result;
}
