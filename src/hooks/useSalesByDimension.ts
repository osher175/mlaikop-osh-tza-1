import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { getEffectiveFinancialStartDate, getYearEnd } from '@/lib/financialConfig';
import type { SalesDimension, SalesDimensionItem } from '@/types/salesDimensions';

/**
 * Fetches top sales data grouped by a selected dimension (product, brand, category, supplier).
 * Uses the get_top_sales_by_dimension RPC — server-side aggregation.
 * Query key includes 'sales_by_dimension' for targeted realtime invalidation.
 */
export const useSalesByDimension = (dimension: SalesDimension) => {
  const { business } = useBusiness();
  const currentYear = new Date().getFullYear();
  const dateFrom = getEffectiveFinancialStartDate(currentYear).toISOString();
  const dateTo = getYearEnd(currentYear).toISOString();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sales_by_dimension', business?.id, dimension, dateFrom, dateTo],
    queryFn: async () => {
      if (!business?.id) return [];

      if (import.meta.env.DEV) {
        console.log('[useSalesByDimension] Fetching:', { dimension, dateFrom, dateTo });
      }

      const { data, error } = await supabase.rpc('get_top_sales_by_dimension', {
        p_business_id: business.id,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_dimension: dimension,
        p_limit: 10,
      });

      if (error) {
        console.error('Error fetching sales by dimension:', error);
        throw error;
      }

      // The RPC returns jsonb which comes as parsed JSON
      const items = (data as unknown as SalesDimensionItem[]) ?? [];
      return items;
    },
    enabled: !!business?.id,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: false,
  });

  return { items: data ?? [], isLoading, isFetching };
};
