import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { ReportsData, isReportsData } from '@/types/reports';
import { getEffectiveFinancialStartDate, getYearEnd } from '@/lib/financialConfig';

/**
 * Dashboard version of reports_aggregate — uses current year as the default period.
 * Returns the same data structure as useReportsData but scoped to the financial year.
 * This ensures dashboard top-products match the reports page for the same period.
 */
export const useDashboardReportsData = () => {
  const { business } = useBusiness();
  const currentYear = new Date().getFullYear();
  const dateFrom = getEffectiveFinancialStartDate(currentYear).toISOString();
  const dateTo = getYearEnd(currentYear).toISOString();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['reports_aggregate', business?.id, 'yearly', dateFrom, dateTo],
    queryFn: async () => {
      if (!business?.id) return null;

      if (import.meta.env.DEV) {
        console.log('[useDashboardReportsData] Fetching:', { dateFrom, dateTo });
      }

      const { data, error } = await supabase.rpc('reports_aggregate', {
        business_id: business.id,
        date_from: dateFrom,
        date_to: dateTo,
      });

      if (error) {
        console.error('Error fetching dashboard reports:', error);
        throw error;
      }

      const result = data as unknown;
      if (!isReportsData(result)) return null;
      return result;
    },
    enabled: !!business?.id,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: false,
  });

  return { reportsData: data, isLoading, isFetching };
};
