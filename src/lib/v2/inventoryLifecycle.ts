import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  CUSTOMER_RETURN_READY,
  PURCHASE_RECEIPT_ATOMIC_READY,
  STOCK_ADJUSTMENT_RPC_READY,
  SUPPLIER_RETURN_DISPATCH_READY,
  SUPPLIER_RETURN_READY,
} from '@/lib/v2/inventoryFlags';
import { purchaseReceiptQuantityValid } from '@/lib/v2/quantityRules';

export {
  CUSTOMER_RETURN_READY,
  PURCHASE_RECEIPT_ATOMIC_READY,
  STOCK_ADJUSTMENT_RPC_READY,
  SUPPLIER_RETURN_READY,
} from '@/lib/v2/inventoryFlags';

export type CustomerReturnDisposition = 'restock' | 'damaged';

interface LifecycleResult {
  action_id: string;
  replayed: boolean;
  new_quantity: number | null;
}

const closed = (message: string) => {
  throw new Error(message);
};

const readResult = (value: Json | null): LifecycleResult | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const actionId = value.action_id;
  const replayed = value.replayed;
  const quantity = value.new_quantity;
  if (typeof actionId !== 'string' || typeof replayed !== 'boolean') return null;
  if (quantity != null && typeof quantity !== 'number') return null;
  return { action_id: actionId, replayed, new_quantity: typeof quantity === 'number' ? quantity : null };
};

/** True when any partial customer return, restocked or damaged, already points at this movement. */
export async function customerReturnBlocksReversal(actionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('inventory_actions')
    .select('id')
    .eq('reference_type', 'customer_return')
    .filter('reference_meta->>original_action_id', 'eq', actionId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

const finish = (value: Json | null): LifecycleResult => {
  const result = readResult(value);
  if (!result) throw new Error('הפעולה נכשלה. לא התקבל אישור מהשרת.');
  return result;
};

/**
 * One purchase receipt. Unknown unit cost stays null.
 * Refuses before any request while the flag is off.
 */
export async function recordPurchaseReceipt(input: {
  businessId: string;
  productId: string;
  quantity: number;
  idempotencyKey: string;
  unitCost: number | null;
  supplierId?: string | null;
  notes?: string;
}): Promise<LifecycleResult> {
  if (!PURCHASE_RECEIPT_ATOMIC_READY) closed('קליטת הרכש האטומית עדיין כבויה. המלאי לא השתנה.');
  if (!purchaseReceiptQuantityValid(input.quantity)) closed('invalid quantity');
  const { data, error } = await supabase.rpc('record_purchase_receipt', {
    p_business_id: input.businessId,
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_idempotency_key: input.idempotencyKey,
    p_unit_cost: input.unitCost,
    p_supplier_id: input.supplierId ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return finish(data);
}

/** Count correction, damage, or loss. The signed-in user is the actor, not a salesperson. */
export async function recordStockAdjustment(input: {
  businessId: string;
  productId: string;
  quantityChanged: number;
  idempotencyKey: string;
  reason: string;
  notes?: string;
}): Promise<LifecycleResult> {
  if (!STOCK_ADJUSTMENT_RPC_READY) closed('התאמת המלאי האטומית עדיין כבויה. המלאי לא השתנה.');
  if (!Number.isInteger(input.quantityChanged) || input.quantityChanged === 0) closed('invalid quantity');
  if (!input.reason.trim()) closed('adjustment reason is required');
  const { data, error } = await supabase.rpc('record_stock_adjustment', {
    p_business_id: input.businessId,
    p_product_id: input.productId,
    p_quantity_changed: input.quantityChanged,
    p_idempotency_key: input.idempotencyKey,
    p_reason: input.reason.trim(),
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return finish(data);
}

/** Goods sent back to a supplier. This does not record a financial credit. */
export async function recordSupplierReturn(input: {
  businessId: string;
  productId: string;
  supplierId: string;
  quantity: number;
  idempotencyKey: string;
  reason: string;
  notes?: string;
}): Promise<LifecycleResult> {
  if (!SUPPLIER_RETURN_READY) closed('החזרה לספק עדיין כבויה. המלאי לא השתנה.');
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) closed('invalid quantity');
  if (!input.reason.trim()) closed('return reason is required');
  const { data, error } = await supabase.rpc('record_supplier_return', {
    p_business_id: input.businessId,
    p_product_id: input.productId,
    p_supplier_id: input.supplierId,
    p_quantity: input.quantity,
    p_idempotency_key: input.idempotencyKey,
    p_reason: input.reason.trim(),
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return finish(data);
}

export interface SupplierDispatchResult {
  returnId: string;
  returnNumber: string;
  replayed: boolean;
  creditStatus: string;
  expectedCreditIls: number | null;
  movementIds: string[];
}

/**
 * Confirmed physical dispatch for one multi-line return.
 * Does not run while SUPPLIER_RETURN_DISPATCH_READY is false, so an absent RPC is not called.
 * This is separate from recordSupplierReturn and does not record a financial credit.
 */
export async function confirmSupplierReturnDispatch(input: {
  businessId: string;
  supplierId: string;
  reason: string;
  notes?: string;
  lines: Array<{ productId: string; quantity: number; unitCost: number | null }>;
  idempotencyKey: string;
}): Promise<SupplierDispatchResult> {
  if (!SUPPLIER_RETURN_DISPATCH_READY) closed('מסירה לספק עדיין כבויה. אישור המסירה לא נשלח, והמלאי לא השתנה.');
  const { data, error } = await supabase.rpc('confirm_supplier_return_dispatch', {
    p_business_id: input.businessId,
    p_supplier_id: input.supplierId,
    p_reason: input.reason,
    p_notes: input.notes ?? null,
    p_lines: input.lines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
      unit_cost: line.unitCost,
    })),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data)) closed('המסירה לא הושלמה.');
  const row = data as { [key: string]: Json | undefined };
  const movementIds = Array.isArray(row.movement_ids) ? row.movement_ids.filter((id): id is string => typeof id === 'string') : [];
  if (typeof row.return_id !== 'string' || typeof row.return_number !== 'string' || typeof row.replayed !== 'boolean') {
    closed('המסירה לא הושלמה.');
  }
  return {
    returnId: String(row.return_id),
    returnNumber: String(row.return_number),
    replayed: row.replayed === true,
    creditStatus: typeof row.credit_status === 'string' ? row.credit_status : 'not_recorded',
    expectedCreditIls: typeof row.expected_credit_ils === 'number' ? row.expected_credit_ils : null,
    movementIds,
  };
}

/**
 * Partial inventory return against one sale movement.
 * restock puts units back. damaged records the return and leaves stock unchanged.
 * This does not reverse the sale and does not settle a refund.
 */
export async function recordCustomerReturn(input: {
  businessId: string;
  originalActionId: string;
  quantity: number;
  idempotencyKey: string;
  disposition: CustomerReturnDisposition;
  notes?: string;
}): Promise<LifecycleResult> {
  if (!CUSTOMER_RETURN_READY) closed('החזרת לקוח למלאי עדיין כבויה. המלאי לא השתנה.');
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) closed('invalid quantity');
  const { data, error } = await supabase.rpc('record_customer_return', {
    p_business_id: input.businessId,
    p_original_action_id: input.originalActionId,
    p_quantity: input.quantity,
    p_idempotency_key: input.idempotencyKey,
    p_disposition: input.disposition,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return finish(data);
}
