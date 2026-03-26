import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { useMemo } from 'react';
import { ReportsData, isReportsData } from '@/types/reports';
import { ComputedDateRange, ReportFilters } from './useReportFilters';

/**
 * Unified reports data hook.
 * All components on the reports page MUST use this single hook
 * via the same filters/dateRange to ensure consistency.
 */
export const useReportsData = (filters: ReportFilters, dateRange: ComputedDateRange) => {
  const { business } = useBusiness();

  // Query key includes normalized filter values — ensures all consumers stay in sync
  const queryKey = useMemo(() => [
    'reports_aggregate',
    business?.id,
    filters.periodType,
    dateRange.from,
    dateRange.to,
  ], [business?.id, filters.periodType, dateRange.from, dateRange.to]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!business?.id) return null;

      if (import.meta.env.DEV) {
        console.log('[useReportsData] Fetching with:', {
          business_id: business.id,
          date_from: dateRange.from,
          date_to: dateRange.to,
          filters,
        });
      }

      const { data, error } = await supabase.rpc('reports_aggregate', {
        business_id: business.id,
        date_from: dateRange.from,
        date_to: dateRange.to,
      });

      if (error) {
        console.error('Error fetching reports:', error);
        throw error;
      }

      const result = data as unknown;
      if (!isReportsData(result)) {
        console.error('Invalid reports data structure:', result);
        throw new Error('הנתונים שהתקבלו מהשרת אינם תואמים את המבנה המצופה');
      }

      return result;
    },
    enabled: !!business?.id,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: false,
  });

  return {
    reportsData: data,
    isLoading,
    error,
    refetch,
  };
};
