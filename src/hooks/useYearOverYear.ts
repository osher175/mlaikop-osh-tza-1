import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { 
  getRelevantFinancialYears,
  getEffectiveFinancialStartDate,
  getYearEnd,
  calculateNetFromGross,
  MONTH_NAMES_HE,
  YearlyFinancialData,
} from '@/lib/financialConfig';

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

interface YearOverYearData {
  years: YearlyFinancialData[];
  monthlyByYear: Record<number, MonthlyFinancialData[]>;
  comparisons: {
    currentYear: number;
    previousYear: number;
    revenueChange: number;
    revenueChangePercent: number;
    profitChange: number;
    profitChangePercent: number;
    discountChange: number;
    discountChangePercent: number;
  } | null;
}

export const useYearOverYear = () => {
  const { businessContext } = useBusinessAccess();

  const { data, isLoading, error } = useQuery({
    queryKey: ['year-over-year', businessContext?.business_id],
    queryFn: async (): Promise<YearOverYearData | null> => {
      if (!businessContext?.business_id) return null;

      // Get last 3 years for comparison (more practical than all years from 2020)
      const availableYears = getRelevantFinancialYears(3);
      const currentYear = new Date().getFullYear();

      // For multi-year comparison, filter by the earliest relevant year
      const earliestYear = Math.min(...availableYears);
      const earliestStart = getEffectiveFinancialStartDate(earliestYear);
      const latestEnd = getYearEnd(currentYear);

      // Server-side filtering for better performance
      const { data: inventoryActions, error: actionsError } = await supabase
        .from('inventory_actions')
        .select(`
          id,
          action_type,
          quantity_changed,
          timestamp,
          sale_total_ils,
          discount_ils,
          discount_percent,
          cost_snapshot_ils,
          purchase_total_ils
        `)
        .eq('business_id', businessContext.business_id)
        .gte('timestamp', earliestStart.toISOString())
        .lte('timestamp', latestEnd.toISOString())
        .order('timestamp', { ascending: false });

      if (actionsError) {
        console.error('Error fetching inventory actions for YoY:', actionsError);
        throw actionsError;
      }

      const years: YearlyFinancialData[] = [];
      const monthlyByYear: Record<number, MonthlyFinancialData[]> = {};

      for (const year of availableYears) {
        const effectiveStart = getEffectiveFinancialStartDate(year);
        const yearEnd = getYearEnd(year);

        // Filter actions for this year
        const yearActions = inventoryActions?.filter(action => {
          const actionDate = new Date(action.timestamp);
          return actionDate >= effectiveStart && actionDate <= yearEnd;
        }) || [];

        // Sales (remove actions)
        const salesActions = yearActions.filter(a => 
          a.action_type === 'remove' && a.sale_total_ils != null
        );

        // Purchases (add actions)
        const purchaseActions = yearActions.filter(a => 
          a.action_type === 'add' && a.purchase_total_ils != null
        );

        // Calculate yearly totals
        const totalRevenue = salesActions.reduce((sum, a) => sum + (Number(a.sale_total_ils) || 0), 0);
        const totalRevenueNet = calculateNetFromGross(totalRevenue);
        const totalPurchases = purchaseActions.reduce((sum, a) => sum + (Number(a.purchase_total_ils) || 0), 0);
        const totalDiscounts = salesActions.reduce((sum, a) => sum + (Number(a.discount_ils) || 0), 0);
        
        // COGS (already without VAT)
        const totalCogs = salesActions.reduce((sum, a) => {
          return sum + (Number(a.cost_snapshot_ils) || 0) * Math.abs(a.quantity_changed);
        }, 0);
        
        // Gross profit (mixed - revenue with VAT minus COGS without VAT)
        const grossProfit = totalRevenue - totalCogs;
        
        // CORRECT: Net profit = revenueNet - COGS (both without VAT)
        const netProfit = totalRevenueNet - totalCogs;

        years.push({
          year,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalRevenueNet: Math.round(totalRevenueNet * 100) / 100,
          totalPurchases: Math.round(totalPurchases * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          netProfit: Math.round(netProfit * 100) / 100,
          totalDiscounts: Math.round(totalDiscounts * 100) / 100,
          transactionCount: salesActions.length,
        });

        // Calculate monthly data for this year
        const monthlyData: MonthlyFinancialData[] = [];
        
        for (let month = 0; month < 12; month++) {
          const monthStart = new Date(year, month, 1);
          const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

          // Only include months that are within the effective financial period
          if (monthEnd < effectiveStart) {
            monthlyData.push({
              month: MONTH_NAMES_HE[month],
              monthIndex: month,
              revenue: 0,
              revenueNet: 0,
              purchases: 0,
              grossProfit: 0,
              netProfit: 0,
              discounts: 0,
              transactionCount: 0,
            });
            continue;
          }

          const monthSales = salesActions.filter(a => {
            const d = new Date(a.timestamp);
            return d >= monthStart && d <= monthEnd;
          });

          const monthPurchases = purchaseActions.filter(a => {
            const d = new Date(a.timestamp);
            return d >= monthStart && d <= monthEnd;
          });

          const monthRevenue = monthSales.reduce((sum, a) => sum + (Number(a.sale_total_ils) || 0), 0);
          const monthRevenueNet = calculateNetFromGross(monthRevenue);
          const monthPurchaseTotal = monthPurchases.reduce((sum, a) => sum + (Number(a.purchase_total_ils) || 0), 0);
          const monthDiscounts = monthSales.reduce((sum, a) => sum + (Number(a.discount_ils) || 0), 0);
          
          // COGS for the month (already without VAT)
          const monthCogs = monthSales.reduce((sum, a) => {
            return sum + (Number(a.cost_snapshot_ils) || 0) * Math.abs(a.quantity_changed);
          }, 0);
          
          const monthGrossProfit = monthRevenue - monthCogs;
          
          // CORRECT: Net profit = revenueNet - COGS
          const monthNetProfit = monthRevenueNet - monthCogs;

          monthlyData.push({
            month: MONTH_NAMES_HE[month],
            monthIndex: month,
            revenue: Math.round(monthRevenue * 100) / 100,
            revenueNet: Math.round(monthRevenueNet * 100) / 100,
            purchases: Math.round(monthPurchaseTotal * 100) / 100,
            grossProfit: Math.round(monthGrossProfit * 100) / 100,
            netProfit: Math.round(monthNetProfit * 100) / 100,
            discounts: Math.round(monthDiscounts * 100) / 100,
            transactionCount: monthSales.length,
          });
        }

        monthlyByYear[year] = monthlyData;
      }

      // Calculate YoY comparison
      let comparisons = null;
      const currentYearData = years.find(y => y.year === currentYear);
      const previousYearData = years.find(y => y.year === currentYear - 1);

      if (currentYearData && previousYearData && previousYearData.totalRevenue > 0) {
        const revenueChange = currentYearData.totalRevenue - previousYearData.totalRevenue;
        const revenueChangePercent = (revenueChange / previousYearData.totalRevenue) * 100;
        
        const profitChange = currentYearData.netProfit - previousYearData.netProfit;
        const profitChangePercent = previousYearData.netProfit !== 0 
          ? (profitChange / Math.abs(previousYearData.netProfit)) * 100 
          : 0;
        
        const discountChange = currentYearData.totalDiscounts - previousYearData.totalDiscounts;
        const discountChangePercent = previousYearData.totalDiscounts !== 0
          ? (discountChange / previousYearData.totalDiscounts) * 100
          : 0;

        comparisons = {
          currentYear,
          previousYear: currentYear - 1,
          revenueChange: Math.round(revenueChange * 100) / 100,
          revenueChangePercent: Math.round(revenueChangePercent * 100) / 100,
          profitChange: Math.round(profitChange * 100) / 100,
          profitChangePercent: Math.round(profitChangePercent * 100) / 100,
          discountChange: Math.round(discountChange * 100) / 100,
          discountChangePercent: Math.round(discountChangePercent * 100) / 100,
        };
      }

      return {
        years,
        monthlyByYear,
        comparisons,
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
