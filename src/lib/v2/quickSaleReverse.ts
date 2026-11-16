import { supabase } from '@/integrations/supabase/client';
import { customerReturnBlocksReversal } from '@/lib/v2/inventoryLifecycle';
import { fullReversalClosed } from '@/lib/v2/reversalRules';
import { QUICK_SALE_PERSISTENCE_READY } from '@/lib/v2/employeeAttribution';
import { hebrewSaleError } from '@/lib/v2/saleErrors';
import { readQuickSaleRpcResult, type QuickSaleRpcResult } from '@/lib/v2/upgradeContract';

export interface ReversedQuickSale {
  transactionId: string;
  replayed: boolean;
}

/**
 * Reverses one V2 sale through reverse_quick_sale.
 * Not mounted on a screen: there is no V2 transaction history yet.
 * Connect it later from that history, after an explicit confirmation, and then refresh
 * QUICK_SALE_REFRESH_KEYS. Do not pass a V2 transaction to reverse_inventory_action.
 * The call is refused while the activation gate is closed, so this task cannot reverse a sale.
 */
export async function reverseQuickSale(businessId: string, transactionId: string): Promise<ReversedQuickSale> {
  if (!QUICK_SALE_PERSISTENCE_READY) {
    throw new Error('ביטול עסקת V2 כבוי עד להפעלה המבוקרת.');
  }
  if (!businessId || !transactionId) {
    throw new Error('העסקה לא נמצאה בעסק הזה.');
  }
  const { data: lines, error: lineError } = await supabase
    .from('sale_lines')
    .select('inventory_action_id')
    .eq('business_id', businessId)
    .eq('transaction_id', transactionId);
  if (lineError) throw new Error('לא הצלחנו לבדוק החזרות קודמות. המלאי לא שונה.');
  for (const line of lines ?? []) {
    if (fullReversalClosed(await customerReturnBlocksReversal(line.inventory_action_id))) {
      throw new Error('אי אפשר לבטל את כל המכירה אחרי החזרה חלקית. המלאי לא שונה.');
    }
  }
  const { data, error } = await supabase.rpc('reverse_quick_sale', {
    p_business_id: businessId,
    p_transaction_id: transactionId,
  });
  if (error) throw new Error(hebrewSaleError(error));
  const parsed: QuickSaleRpcResult | null = readQuickSaleRpcResult(data);
  if (!parsed) throw new Error('הביטול נכשל. לא התקבל אישור מהשרת.');
  return { transactionId: parsed.transaction_id, replayed: parsed.replayed };
}
