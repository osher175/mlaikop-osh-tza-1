import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

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
      if (!businessId || ids.length === 0) return new Map<string, number>();
      const { data, error } = await supabase.rpc('import_quantity_in_transit', {
        p_business_id: businessId,
        p_product_ids: ids.slice(0, 100),
      });
      // In-transit is a nice-to-have overlay: never break the inventory page.
      if (error) return new Map<string, number>();
      const map = new Map<string, number>();
      (data as Array<{ product_id: string; quantity_in_transit: number }> | null)?.forEach((r) => {
        map.set(r.product_id, Number(r.quantity_in_transit ?? 0));
      });
      return map;
    },
    enabled: !!businessId && ids.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return query.data ?? new Map<string, number>();
};
