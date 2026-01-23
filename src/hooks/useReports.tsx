import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { useMemo } from 'react';
import { ReportsData, isReportsData } from '@/types/reports';
import { getEffectiveFinancialStartDate } from '@/lib/financialConfig';

export type ReportsRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Get date range for reports, respecting the financial tracking start date
 * Financial data only starts from the configured financial_tracking_start_at date
 */
function getDateRange(range: ReportsRange): { date_from: string; date_to: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const financialStartDate = getEffectiveFinancialStartDate(currentYear);
  
  let date_from: Date;
  switch (range) {
    case 'daily':
      date_from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      date_from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      date_from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'yearly':
      date_from = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      date_from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  // Ensure we don't go before the financial tracking start date
  const effectiveFrom = date_from > financialStartDate ? date_from : financialStartDate;
  
  return {
    date_from: effectiveFrom.toISOString(),
    date_to: now.toISOString(),
  };
}

export const useReports = (range: ReportsRange) => {
  const { business } = useBusiness();
  const { date_from, date_to } = useMemo(() => getDateRange(range), [range]);

  const queryKey = useMemo(() => [
    'reports_aggregate',
    business?.id,
    range,
    date_from,
    date_to,
  ], [business?.id, range, date_from, date_to]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!business?.id) return null;
      
      console.log('Fetching reports for:', { business_id: business.id, date_from, date_to });
      
      const { data, error } = await supabase.rpc('reports_aggregate', {
        business_id: business.id,
        date_from,
        date_to,
      });
      
      if (error) {
        console.error('Error fetching reports:', error);
        throw error;
      }
      
      // Runtime validation with type guard
      const result = data as unknown;
      if (!isReportsData(result)) {
        console.error('Invalid reports data structure:', result);
        throw new Error('הנתונים שהתקבלו מהשרת אינם תואמים את המבנה המצופה');
      }
      
      return result;
    },
    enabled: !!business?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (previously cacheTime)
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    reportsData: data,
    isLoading,
    error,
    refetch,
  };
};
