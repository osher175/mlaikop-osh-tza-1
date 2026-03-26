import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/hooks/useBusiness';
import { ReportFilters, ComputedDateRange, buildPreviousDateRange } from '@/hooks/useReportFilters';
import { ReportsData, isReportsData } from '@/types/reports';
import { computeBusinessInsights } from './rules';
import { BusinessInsight } from './types';

/**
 * Business Insights hook — consumes the EXACT same filters and dateRange
 * as all other report widgets. Only fetches previous-period data for comparison.
 *
 * @param filters  — from useReportFilters (single source of truth)
 * @param dateRange — from useReportFilters (single source of truth)
 * @param reportsData — from useReportsData (current period, already fetched)
 */
export function useBusinessInsights(
  filters: ReportFilters,
  dateRange: ComputedDateRange,
  reportsData: ReportsData | null | undefined,
) {
  const { business } = useBusiness();

  const previousDateRange = useMemo(
    () => buildPreviousDateRange(filters),
    [filters],
  );

  // Fetch previous period data for comparison insights
  const { data: previousData, isLoading: isPreviousLoading } = useQuery({
    queryKey: [
      'reports_aggregate_previous',
      business?.id,
      filters.periodType,
      previousDateRange.from,
      previousDateRange.to,
    ],
    queryFn: async () => {
      if (!business?.id) return null;

      if (import.meta.env.DEV) {
        console.log('[useBusinessInsights] Fetching previous period:', {
          from: previousDateRange.from,
          to: previousDateRange.to,
        });
      }

      const { data, error } = await supabase.rpc('reports_aggregate', {
        business_id: business.id,
        date_from: previousDateRange.from,
        date_to: previousDateRange.to,
      });

      if (error) {
        console.error('Error fetching previous period reports:', error);
        return null;
      }

      const result = data as unknown;
      return isReportsData(result) ? result : null;
    },
    enabled: !!business?.id && !!reportsData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const insights: BusinessInsight[] = useMemo(() => {
    if (!reportsData) return [];

    const result = computeBusinessInsights(reportsData, previousData ?? null);

    if (import.meta.env.DEV) {
      console.log('[useBusinessInsights] Computed insights:', {
        currentPeriod: { from: dateRange.from, to: dateRange.to },
        previousPeriod: { from: previousDateRange.from, to: previousDateRange.to },
        insightsCount: result.length,
        insights: result.map(i => i.id),
      });
    }

    return result;
  }, [reportsData, previousData, dateRange, previousDateRange]);

  return {
    insights,
    isLoading: isPreviousLoading,
    previousDateRange,
  };
}
