import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { summarizeIncoming, type IncomingLine, type IncomingSummary } from '@/lib/v2/importIncoming';

/**
 * Phase 2 — page-bounded "quantity in transit" read model.
 *
 * Only the product ids rendered on the CURRENT inventory page (max 50) are sent
 * to the database, which aggregates open import quantities server side:
 *
 *   in_transit = ordered - confirmed_received - resolved_as_not_arriving   (min 0)
 *
 * Draft receipts are invisible here — only confirmed receipts move the number.
 * The RPC returns quantities only: no supplier, cost, freight or landed-cost data.
 */
export const useInTransitQuantities = (productIds: string[]) => {
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id;

  // Bounded and order-independent cache key
  const ids = [...productIds].filter(Boolean).sort();

  const query = useQuery({
    queryKey: ['import-in-transit', businessId, ids.join(',')],
    queryFn: async () => {
      if (!businessId || ids.length === 0) return { ok: true as const, quantities: new Map<string, number>() };
      const { data, error } = await supabase.rpc('import_quantity_in_transit', {
        p_business_id: businessId,
        p_product_ids: ids.slice(0, 100),
      });
      if (error) return { ok: false as const, quantities: new Map<string, number>() };
      const quantities = new Map<string, number>();
      (data as Array<{ product_id: string; quantity_in_transit: number }> | null)?.forEach((r) => {
        quantities.set(r.product_id, Number(r.quantity_in_transit ?? 0));
      });
      return { ok: true as const, quantities };
    },
    enabled: !!businessId && ids.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!businessId || ids.length === 0 || query.isPending || !query.data) {
    return { status: 'ok' as const, data: new Map<string, number>() };
  }
  if (!query.data.ok) return { status: 'unavailable' as const };
  return { status: 'ok' as const, data: query.data.quantities };
};

/** Arrival dates from open import lines. A failed read stays unknown and does not invent a date. */
export const useIncomingSummaries = (productIds: string[]) => {
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id;
  const ids = [...productIds].filter(Boolean).sort();

  const query = useQuery({
    queryKey: ['import-incoming-summary', businessId, ids.join(',')],
    queryFn: async () => {
      if (!businessId || ids.length === 0) return { ok: true as const, rows: new Map<string, IncomingSummary>() };
      const { data, error } = await supabase
        .from('import_order_items')
        .select('product_id, ordered_quantity, received_quantity, not_arriving_quantity, item_status, import_orders!inner(status, estimated_arrival_date)')
        .eq('business_id', businessId)
        .in('product_id', ids.slice(0, 100));
      if (error || !data) return { ok: false as const, rows: new Map<string, IncomingSummary>() };
      const lines: IncomingLine[] = data.flatMap((row) => {
        const order = Array.isArray(row.import_orders) ? row.import_orders[0] : row.import_orders;
        if (!row.product_id || !order) return [];
        return [{
          productId: row.product_id,
          ordered: row.ordered_quantity,
          received: row.received_quantity,
          notArriving: row.not_arriving_quantity,
          itemStatus: row.item_status,
          orderStatus: order.status,
          estimatedArrival: order.estimated_arrival_date,
        }];
      });
      return { ok: true as const, rows: new Map(summarizeIncoming(lines).map((row) => [row.productId, row])) };
    },
    enabled: !!businessId && ids.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!businessId || ids.length === 0 || query.isPending || !query.data) {
    return { status: 'ok' as const, data: new Map<string, IncomingSummary>() };
  }
  if (!query.data.ok) return { status: 'unavailable' as const };
  return { status: 'ok' as const, data: query.data.rows };
};
