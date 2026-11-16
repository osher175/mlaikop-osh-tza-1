import { supabase } from '@/integrations/supabase/client';
import { QUICK_SALE_PERSISTENCE_READY } from '@/lib/v2/employeeAttribution';
import { rangeToUtc, type AttributedSaleRow, type DayRange, type SaleRow } from '@/lib/v2/dashboardMetrics';

const PAGE = 1000;

/**
 * Reads completed, non-reversed quick-sale lines.
 * Returns nothing while the activation gate is closed.
 * Discount columns are selected only on that path. They exist after
 * docs/v2/sale-list-price-snapshot.UNAPPLIED.sql. Do not open this gate before that file.
 * Line gross is the sale amount. Header totals are not summed here.
 * Legacy inventory_actions stay in the other query. Quick-sale movements leave
 * sale_total_ils null, so that query does not count them a second time.
 */
export async function loadQuickSaleFacts(businessId: string, range: DayRange): Promise<AttributedSaleRow[]> {
  if (!QUICK_SALE_PERSISTENCE_READY) return [];
  const { start, endExclusive } = rangeToUtc(range);
  const { data: transactions, error } = await supabase
    .from('sale_transactions')
    .select('id, sold_at, salesperson_employee_id, status, reversed_at')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .is('reversed_at', null)
    .gte('sold_at', start)
    .lt('sold_at', endExclusive);
  if (error) throw error;
  const list = transactions ?? [];
  if (list.length === 0) return [];

  const byId = new Map(list.map((txn) => [txn.id, txn]));
  const ids = [...byId.keys()];
  const lines: {
    id: string;
    transaction_id: string;
    product_id: string;
    quantity: number;
    unit_price_gross_ils: number;
    unit_cost_ils: number | null;
    list_unit_gross_ils: number | null;
    discount_ils: number | null;
    discount_percent: number | null;
  }[] = [];
  for (let offset = 0; offset < ids.length * 50; offset += PAGE) {
    const { data, error: lineError } = await supabase
      .from('sale_lines')
      .select('id, transaction_id, product_id, quantity, unit_price_gross_ils, unit_cost_ils, list_unit_gross_ils, discount_ils, discount_percent')
      .eq('business_id', businessId)
      .in('transaction_id', ids)
      .range(offset, offset + PAGE - 1);
    if (lineError) throw lineError;
    lines.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  return lines.flatMap((line) => {
    const txn = byId.get(line.transaction_id);
    if (!txn || txn.status !== 'completed' || txn.reversed_at !== null) return [];
    const row: AttributedSaleRow = {
      timestamp: txn.sold_at,
      product_id: line.product_id,
      quantity_changed: -Math.abs(line.quantity),
      sale_total_ils: Math.round((line.unit_price_gross_ils * line.quantity + Number.EPSILON) * 100) / 100,
      cost_snapshot_ils: line.unit_cost_ils,
      cost_known: line.unit_cost_ils !== null,
      salesperson_employee_id: txn.salesperson_employee_id,
      transaction_id: txn.id,
      reference_type: 'sale_line_snapshot',
      list_unit_ils: line.list_unit_gross_ils,
      discount_ils: line.discount_ils,
      discount_percent: line.discount_percent,
    };
    return [row];
  });
}

export const asSaleRows = (rows: AttributedSaleRow[]): SaleRow[] => rows;
