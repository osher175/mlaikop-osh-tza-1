import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/** V1 minimum acceptable gross margin used for the closure warning. */
export const MIN_GROSS_MARGIN_PERCENT = 25;

export interface ClosureItem {
  item_id: string;
  product_id: string | null;
  description: string | null;
  received_quantity: number;
  provisional_unit_cost_ils: number;
  overhead_per_unit_ils: number;
  final_unit_cost_ils: number;
  unit_variance_ils: number;
  total_variance_ils: number;
  quantity_on_hand: number;
  current_product_cost_ils: number;
  current_price_ils: number | null;
  planned_sale_price_ils: number | null;
  gross_profit_per_unit_ils: number | null;
  gross_margin_percent: number | null;
}

export interface ClosureReadiness {
  order_status: string;
  already_closed: boolean;
  already_posted: boolean;
  has_confirmed_receipt: boolean;
  open_quantity: number;
  unlinked_received_items: number;
  unfinalized_cost_lines: number;
  open_draft_receipts: number;
  total_overhead_ils: number;
  applicable_received_units: number;
  overhead_per_unit_ils: number;
  can_close: boolean;
  items: ClosureItem[];
}

/**
 * Phase 3 — import closure & final landed-cost posting.
 *
 * INVARIANT: closing an import is a COST-ONLY operation. It never adds,
 * removes or corrects stock quantities, and it never rewrites historical
 * sales: the sale-time `cost_snapshot_ils` on `inventory_actions` stays as it
 * was. The variance attributable to units already sold is recorded in the
 * immutable `import_cost_adjustments` ledger as "unabsorbed".
 */
export const useImportClosure = (orderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const readiness = useQuery({
    queryKey: ['import-closure-readiness', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('import_closure_readiness', {
        p_import_order_id: orderId!,
      });
      if (error) throw error;
      return data as unknown as ClosureReadiness;
    },
    enabled: !!orderId,
  });

  const adjustments = useQuery({
    queryKey: ['import-cost-adjustments', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_cost_adjustments')
        .select('*')
        .eq('import_order_id', orderId!)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orderId,
  });

  const summary = useQuery({
    queryKey: ['import-order-summary', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('import_order_summary', {
        p_import_order_id: orderId!,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!orderId,
  });

  const closeOrder = useMutation({
    mutationFn: async ({
      pinToken,
      priceUpdates,
    }: {
      pinToken: string | null;
      priceUpdates: { item_id: string; price: number }[];
    }) => {
      const { data, error } = await supabase.rpc('import_order_close', {
        p_import_order_id: orderId!,
        p_pin_token: pinToken,
        p_price_updates: priceUpdates as unknown as never,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res: any) => {
      ['import-closure-readiness', 'import-cost-adjustments', 'import-order-summary',
       'import-order', 'import-order-items', 'import-order-events'].forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k, orderId] })
      );
      queryClient.invalidateQueries({ queryKey: ['import-orders-page'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-products-page'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'היבוא נסגר ועלות הנחיתה נרשמה',
        description: `הותאמו ${res?.lines ?? 0} שורות · הוטמע במלאי ₪${Number(
          res?.applied_to_inventory_ils ?? 0
        ).toFixed(2)}`,
      });
    },
    onError: (e: any) =>
      toast({ title: 'הסגירה לא בוצעה', description: e.message, variant: 'destructive' }),
  });

  return { readiness, adjustments, summary, closeOrder };
};
