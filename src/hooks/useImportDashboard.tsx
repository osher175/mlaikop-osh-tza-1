import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { mapItemRow, mapOrderRow, mapPaymentRow } from '@/lib/v2/importDashboardMetrics';

export function useImportDashboard() {
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id;

  return useQuery({
    queryKey: ['import-dashboard', businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const [ordersRes, itemsRes, paymentsRes] = await Promise.all([
        supabase
          .from('import_orders')
          .select('*, suppliers:supplier_id(name)')
          .eq('business_id', businessId!)
          .order('order_date', { ascending: false })
          .limit(500),
        supabase
          .from('import_order_items')
          .select('import_order_id, ordered_quantity, received_quantity, supplier_unit_cost, currency_code, product_description, supplier_sku, item_status, brands:brand_id(name)')
          .eq('business_id', businessId!)
          .limit(2000),
        supabase
          .from('import_payments')
          .select('import_order_id, amount, currency_code, payment_status, payment_type, import_cost_id')
          .eq('business_id', businessId!)
          .limit(2000),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      return {
        orders: (ordersRes.data ?? []).map((row) => mapOrderRow(row as never)),
        items: (itemsRes.data ?? []).map((row) => mapItemRow(row)),
        payments: (paymentsRes.data ?? []).map((row) => mapPaymentRow(row)),
      };
    },
  });
}
