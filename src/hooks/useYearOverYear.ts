import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { MONTH_NAMES_HE, YearlyFinancialData } from '@/lib/financialConfig';

/**
 * Phase A2.S2 — Year-over-Year is aggregated server-side.
 *
 * Previously this hook downloaded every `inventory_actions` row for the last three
 * years and summed them in the browser. That was subject to the PostgREST row cap,
 * so the totals were computed from a truncated result set, and it used a stale
 * action_type rule set that missed all `sale` rows.
 *
 * It now calls `public.yoy_financials(p_business_id, p_years)`, which returns a
 * single small aggregate payload. The business rules live in the RPC and are
 * aligned with `reports_aggregate`:
 *   sales     : action_type IN ('remove','sale')  AND sale_total_ils IS NOT NULL
 *   purchases : action_type IN ('add','purchase') AND purchase_total_ils IS NOT NULL
 *   reversals : excluded
 *   VAT       : revenueNet = revenue / 1.18, netProfit = revenueNet - COGS
 *   boundaries: calendar year/month in Asia/Jerusalem
 */

const YEARS_BACK = 3;

interface MonthlyFinancialData {
  month: string;
  monthIndex: number;
  revenue: number;
  revenueNet: number;
  purchases: number;
  grossProfit: number;
  netProfit: number;
  discounts: number;
  transactionCount: number;
}

interface YearOverYearComparisons {
  currentYear: number;
  previousYear: number;
  revenueChange: number;
  revenueChangePercent: number;
  profitChange: number;
  profitChangePercent: number;
  discountChange: number;
  discountChangePercent: number;
}

interface YearOverYearData {
  years: YearlyFinancialData[];
  monthlyByYear: Record<number, MonthlyFinancialData[]>;
  comparisons: YearOverYearComparisons | null;
}

/** Shape returned by the yoy_financials RPC (month labels are applied client-side). */
interface YoyRpcPayload {
  years: YearlyFinancialData[];
  monthlyByYear: Record<string, Omit<MonthlyFinancialData, 'month'>[]>;
  comparisons: YearOverYearComparisons | null;
}

export const useYearOverYear = () => {
  const { businessContext } = useBusinessAccess();

  const { data, isLoading, error } = useQuery({
    queryKey: ['year-over-year', businessContext?.business_id],
    queryFn: async (): Promise<YearOverYearData | null> => {
      if (!businessContext?.business_id) return null;

      const { data: payload, error: rpcError } = await supabase.rpc('yoy_financials', {
        p_business_id: businessContext.business_id,
        p_years: YEARS_BACK,
      });

      if (rpcError) {
        console.error('Error fetching year-over-year aggregate:', rpcError);
        throw rpcError;
      }

      const result = (payload as unknown as YoyRpcPayload | null) ?? null;
      if (!result) return null;

      // Attach Hebrew month labels in the client so i18n stays in the frontend.
      const monthlyByYear: Record<number, MonthlyFinancialData[]> = {};
      for (const [year, months] of Object.entries(result.monthlyByYear ?? {})) {
        monthlyByYear[Number(year)] = (months ?? []).map((m) => ({
          ...m,
          month: MONTH_NAMES_HE[m.monthIndex],
        }));
      }

      return {
        years: result.years ?? [],
        monthlyByYear,
        comparisons: result.comparisons ?? null,
      };
    },
    enabled: !!businessContext?.business_id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });

  return {
    yoyData: data,
    isLoading,
    error,
    hasData: data != null && data.years.length > 0,
  };
};
