
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { useMemo } from 'react';
import { ReportsData, isReportsData } from '@/types/reports';

export type ReportsRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

function getDateRange(range: ReportsRange): { date_from: string; date_to: string } {
  const now = new Date();
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
  return {
    date_from: date_from.toISOString(),
    date_to: now.toISOString(),
  };
}

export const useOptimizedReports = (range: ReportsRange) => {
  const { business } = useBusiness();
  const { date_from, date_to } = useMemo(() => getDateRange(range), [range]);

  const queryKey = useMemo(() => [
    'optimized_reports',
    business?.id,
    range,
    date_from,
    date_to,
  ], [business?.id, range, date_from, date_to]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!business?.id) return null;
      
      console.log('Fetching optimized reports for:', { business_id: business.id, date_from, date_to });
      
      const { data, error } = await supabase.rpc('reports_aggregate_optimized', {
        business_id: business.id,
        date_from,
        date_to,
      });
      
      if (error) {
        console.error('Error fetching optimized reports:', error);
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
    staleTime: 5 * 60 * 1000, // 5 minutes - longer for reports
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
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
