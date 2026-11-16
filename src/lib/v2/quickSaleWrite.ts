import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { requireActiveSalesperson } from '@/lib/v2/activeSalesperson';
import { QUICK_SALE_PERSISTENCE_READY } from '@/lib/v2/employeeAttribution';
import type { Axle, SaleDraft } from '@/lib/v2/saleDraft';
import { hebrewSaleError } from '@/lib/v2/saleErrors';
import { UNKNOWN_COST_SALE_MESSAGE } from '@/lib/v2/legacyInventoryWrite';
import { quoteDraft } from '@/lib/v2/saleQuote';
import { readQuickSaleRpcResult, type QuickSaleRpcResult } from '@/lib/v2/upgradeContract';

export interface CompletedQuickSale {
  transactionId: string;
  replayed: boolean;
}

const validPrice = (value: number) =>
  Number.isFinite(value) && value >= 0 && value <= 9999999.99 && Number(value.toFixed(2)) === value;

const validQuantity = (value: number) => Number.isInteger(value) && value >= 1 && value <= 10000;

/**
 * Sends the current draft to complete_quick_sale.
 * Does not change product rows itself. Refuses to call the RPC while the activation gate is closed.
 * The same draft keeps its idempotency key, so a retry does not create a second sale.
 */
export async function completeQuickSale(draft: SaleDraft): Promise<CompletedQuickSale> {
  if (!draft.salespersonEmployeeId) {
    throw new Error('יש לבחור איש מכירות לפני אישור העסקה');
  }
  if (!QUICK_SALE_PERSISTENCE_READY) {
    throw new Error('השמירה האטומית עדיין כבויה. הטיוטה לא נשלחה.');
  }
  if (!quoteDraft(draft.lines).costComplete) {
    throw new Error(UNKNOWN_COST_SALE_MESSAGE);
  }
  await requireActiveSalesperson(draft.businessId, draft.salespersonEmployeeId);
  if (draft.lines.length < 1 || draft.lines.length > 50) {
    throw new Error('עסקה צריכה להכיל בין שורה אחת ל-50 שורות.');
  }

  const p_lines: Json = draft.lines.map((line) => {
    if (line.unitPriceGross === null || !validPrice(line.unitPriceGross) || !validQuantity(line.quantity)) {
      throw new Error('מחיר או כמות אינם תקינים. העסקה לא נשמרה.');
    }
    const axle: Axle = line.axle;
    return {
      product_id: line.productId,
      quantity: line.quantity,
      unit_price_gross: line.unitPriceGross,
      list_unit_gross: line.listUnitGross ?? null,
      axle,
    };
  });

  const { data, error } = await supabase.rpc('complete_quick_sale', {
    p_business_id: draft.businessId,
    p_idempotency_key: draft.idempotencyKey,
    p_salesperson_employee_id: draft.salespersonEmployeeId,
    p_notes: draft.notes.trim() ? draft.notes.trim() : null,
    p_lines,
  });
  if (error) throw new Error(hebrewSaleError(error));
  const parsed: QuickSaleRpcResult | null = readQuickSaleRpcResult(data);
  if (!parsed) throw new Error('הפעולה נכשלה. לא התקבל אישור מהשרת.');
  return { transactionId: parsed.transaction_id, replayed: parsed.replayed };
}
