import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';

const OPEN_STATUSES = ['draft', 'in_progress', 'waiting_for_quotes', 'quotes_received', 'waiting_for_approval', 'recommended'];

export interface LowStockProduct {
  product_id: string;
  product_name: string;
  quantity: number;
  low_stock_threshold: number;
  open_request_id: string | null;
  open_request_status: string | null;
}

export const useLowStockProducts = () => {
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['low-stock-products', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      const { data: thresholds, error: thError } = await supabase
        .from('product_thresholds')
        .select('product_id, low_stock_threshold, products:products!product_thresholds_product_id_fkey(id, name, quantity)')
        .eq('business_id', businessId);

      if (thError) throw thError;

      const belowThreshold = (thresholds || []).filter((pt: any) => {
        const p = pt.products;
        return p && p.quantity <= pt.low_stock_threshold;
      });

      if (belowThreshold.length === 0) return [];

      const productIds = belowThreshold.map((pt: any) => pt.product_id);
      const { data: openReqs } = await supabase
        .from('procurement_requests')
        .select('id, product_id, status')
        .eq('business_id', businessId)
        .in('status', OPEN_STATUSES)
        .in('product_id', productIds);

      const reqMap = new Map<string, { id: string; status: string }>();
      (openReqs || []).forEach((r: any) => {
        if (!reqMap.has(r.product_id)) {
          reqMap.set(r.product_id, { id: r.id, status: r.status });
        }
      });

      return belowThreshold.map((pt: any) => {
        const req = reqMap.get(pt.product_id);
        return {
          product_id: pt.product_id,
          product_name: pt.products.name,
          quantity: pt.products.quantity,
          low_stock_threshold: pt.low_stock_threshold,
          open_request_id: req?.id || null,
          open_request_status: req?.status || null,
        } as LowStockProduct;
      });
    },
    enabled: !!businessId,
  });

  return { products, isLoading };
};
