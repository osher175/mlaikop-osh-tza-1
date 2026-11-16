import type { Json } from '@/integrations/supabase/types';

/**
 * Parsed result of complete_quick_sale and reverse_quick_sale.
 * The database returns jsonb, so callers must pass it through readQuickSaleRpcResult.
 */
export interface QuickSaleRpcResult {
  transaction_id: string;
  replayed: boolean;
}

export function readQuickSaleRpcResult(value: Json | null): QuickSaleRpcResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const transactionId = value.transaction_id;
  const replayed = value.replayed;
  if (typeof transactionId !== 'string' || typeof replayed !== 'boolean') return null;
  return { transaction_id: transactionId, replayed };
}

/** Query keys a successful reversal should refresh. There is no V2 history screen yet. */
export const QUICK_SALE_REFRESH_KEYS = [
  'v2-dashboard-sales',
  'v2-employee-attribution',
  'v2-employees',
  'v2-movement-journal',
  'v2-movement-counts',
  'v2-movement-money',
  'products',
  'inventory-products',
] as const;
