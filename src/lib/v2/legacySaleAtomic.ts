import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

/**
 * Stays false until record_legacy_sale is applied and a deployed client
 * calls it. The dialog does not take this branch while the flag is false.
 * Turning the flag on without the deployed function does not make a sale atomic.
 */
export const LEGACY_SALE_ATOMIC_READY = false;

export interface LegacySaleAtomicInput {
  businessId: string;
  productId: string;
  quantitySold: number;
  saleTotalIls: number;
  notes?: string;
  salespersonEmployeeId?: string | null;
  idempotencyKey: string;
}

export interface LegacySaleAtomicResult {
  action_id: string;
  replayed: boolean;
  new_quantity: number | null;
}

const readResult = (value: Json | null): LegacySaleAtomicResult | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const actionId = value.action_id;
  const replayed = value.replayed;
  const quantity = value.new_quantity;
  if (typeof actionId !== 'string' || typeof replayed !== 'boolean') return null;
  if (quantity != null && typeof quantity !== 'number') return null;
  return { action_id: actionId, replayed, new_quantity: typeof quantity === 'number' ? quantity : null };
};

/**
 * Calls the unapplied record_legacy_sale RPC.
 * Refuses before any request while the rollout flag is off.
 * Does not read the signed-in user as the salesperson.
 */
export async function recordLegacySaleAtomic(input: LegacySaleAtomicInput): Promise<LegacySaleAtomicResult> {
  if (!LEGACY_SALE_ATOMIC_READY) {
    throw new Error('השמירה האטומית של המכירה הישנה עדיין כבויה. המלאי לא השתנה.');
  }
  if (!input.idempotencyKey) {
    throw new Error('invalid legacy sale');
  }
  if (!Number.isInteger(input.quantitySold) || input.quantitySold <= 0 || !(input.saleTotalIls > 0)) {
    throw new Error('invalid quantity');
  }

  const { data, error } = await supabase.rpc('record_legacy_sale', {
    p_business_id: input.businessId,
    p_product_id: input.productId,
    p_quantity: input.quantitySold,
    p_sale_total_ils: input.saleTotalIls,
    p_idempotency_key: input.idempotencyKey,
    p_notes: input.notes ?? null,
    p_salesperson_employee_id: input.salespersonEmployeeId ?? null,
  });
  if (error) throw error;
  const result = readResult(data);
  if (!result) throw new Error('הפעולה נכשלה. לא התקבל אישור מהשרת.');
  return result;
}

/** Hebrew text for a failed atomic legacy sale. The stock change is not left behind by this function. */
export function legacySaleError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const text = message.toLowerCase();
  if (text.includes('salesperson is required') || text.includes('יש לבחור איש מכירות')) {
    return 'יש לבחור איש מכירות לפני אישור העסקה';
  }
  if (text.includes('salesperson')) {
    return 'המוכר שנבחר אינו פעיל בעסק. יש לבחור איש מכירות פעיל.';
  }
  if (text.includes('insufficient stock')) {
    return 'אין מספיק מלאי. העסקה לא נשמרה והמלאי לא השתנה.';
  }
  if (text.includes('invalid quantity') || text.includes('invalid sale total') || text.includes('invalid legacy sale')) {
    return 'מחיר או כמות אינם תקינים. העסקה לא נשמרה.';
  }
  if (text.includes('access denied') || text.includes('authentication required') || text.includes('permission')) {
    return 'אין הרשאה לבצע את הפעולה בעסק הזה.';
  }
  if (text.includes('product not found')) {
    return 'המוצר לא נמצא בעסק הזה. המלאי לא השתנה.';
  }
  if (text.includes('failed to fetch') || text.includes('network') || text.includes('fetch')) {
    return 'החיבור נקטע. אפשר לנסות שוב. אותה בקשה לא תוריד מלאי פעם שנייה.';
  }
  return 'הפעולה נכשלה. לא התקבל אישור מהשרת.';
}

/** Same request keeps one key. A changed sale gets a new key. */
export function legacySaleRequestKey(
  current: { signature: string; key: string } | null,
  signature: string,
): { signature: string; key: string } {
  if (current?.signature === signature) return current;
  return { signature, key: crypto.randomUUID() };
}
