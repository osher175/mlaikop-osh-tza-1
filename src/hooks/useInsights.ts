import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import {
  InsightsData,
  InsightsConfig,
  DEFAULT_INSIGHTS_CONFIG,
  LowMarginItem,
  HighDiscountItem,
  DeadStockItem,
  StockoutRiskItem,
  CostSpikeItem,
  BusinessHealthMonth,
  InsightSeverity,
} from '@/types/insights';
import { MONTH_NAMES_HE } from '@/lib/financialConfig';

/**
 * Smart Insights engine.
 *
 * Phase A2.S4: every insight is now aggregated inside the database via the
 * `insights_aggregate` RPC. The previous implementation downloaded 90 days of
 * raw `inventory_actions` plus the full product list and reduced them in the
 * browser, which produced several objectively wrong results:
 *
 *  1. Sales were matched on `action_type = 'remove'` only. Production records
 *     every sale as `action_type = 'sale'`, so Low Margin, High Discount,
 *     Stockout Risk and Business Health were computed over an EMPTY set and
 *     permanently reported "all clear".
 *  2. Purchases were matched on `action_type = 'add'` only, covering ~33% of
 *     real purchase rows, so Cost Spike compared partial data.
 *  3. Reversed / reversal actions were never excluded, double-counting
 *     cancelled transactions.
 *  4. Business Health drew a full calendar year from a 90-day query window, so
 *     the earliest months could never be populated.
 *  5. The last-sale lookup shared bug (1), making nearly every in-stock product
 *     look "never sold" and flooding Dead Stock with actively-selling items.
 *
 * The RPC applies the canonical project rules, shared with `reports_aggregate`,
 * `yoy_financials` and `bi_analytics_yearly`:
 *   sales     = action_type IN ('remove','sale')  AND sale_total_ils     IS NOT NULL
 *   purchases = action_type IN ('add','purchase') AND purchase unit/total IS NOT NULL
 *   reversals excluded, Asia/Jerusalem boundaries, VAT 18%.
 *
 * Severity thresholds, titles, summaries and the business-health warning text
 * remain in the frontend so the UI contract is unchanged.
 */

interface InsightsRpcPayload {
  year: number;
  lowMargin: LowMarginItem[];
  highDiscount: HighDiscountItem[];
  deadStock: DeadStockItem[];
  stockoutRisk: StockoutRiskItem[];
  costSpike: CostSpikeItem[];
  businessHealth: Array<Omit<BusinessHealthMonth, 'month'> & { monthIndex: number }>;
}

export const useInsights = (config: InsightsConfig = DEFAULT_INSIGHTS_CONFIG) => {
  const { businessContext } = useBusinessAccess();

  // Stringify config for stable queryKey
  const configKey = JSON.stringify(config);

  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['insights', businessContext?.business_id, configKey],
    queryFn: async (): Promise<InsightsData | null> => {
      if (!businessContext?.business_id) return null;

      const now = new Date();

      const { data, error: rpcError } = await supabase.rpc('insights_aggregate', {
        p_business_id: businessContext.business_id,
        p_lookback_sales_days: config.lookbackSalesDays,
        p_lookback_purchases_days: config.lookbackPurchasesDays,
        p_stockout_days_cover: config.stockoutDaysCoverThreshold,
        p_dead_stock_days: config.deadStockDays,
        p_high_discount_percent: config.highDiscountPercent,
        p_cost_increase_percent: config.costIncreasePercent,
        p_low_margin_percent: config.lowMarginPercent,
      });

      if (rpcError) {
        console.error('Error fetching insights aggregate:', rpcError);
        throw rpcError;
      }

      const payload = (data as unknown as InsightsRpcPayload | null) ?? null;
      if (!payload) return null;

      const lowMarginItems = payload.lowMargin ?? [];
      const highDiscountItems = payload.highDiscount ?? [];
      const deadStockItems = payload.deadStock ?? [];
      const stockoutRiskItems = payload.stockoutRisk ?? [];
      const costSpikeItems = payload.costSpike ?? [];

      // Hebrew month labels stay in the frontend; the RPC returns indexes only.
      const businessHealthMonths: BusinessHealthMonth[] = (payload.businessHealth ?? []).map(
        (m) => ({ ...m, month: MONTH_NAMES_HE[m.monthIndex] }),
      );

      // ===== Severity thresholds (unchanged) =====
      const getLowMarginSeverity = (margin: number): InsightSeverity => {
        if (margin < 0) return 'high';
        if (margin < config.lowMarginPercent) return 'medium';
        return 'low';
      };

      const getHighDiscountSeverity = (avgDiscount: number): InsightSeverity => {
        if (avgDiscount >= 35) return 'high';
        if (avgDiscount >= 25) return 'medium';
        return 'low';
      };

      const getStockoutSeverity = (daysCover: number): InsightSeverity => {
        if (daysCover < 3) return 'high';
        if (daysCover < 7) return 'medium';
        return 'low';
      };

      const getCostSpikeSeverity = (changePercent: number): InsightSeverity => {
        if (changePercent >= 20) return 'high';
        if (changePercent >= 10) return 'medium';
        return 'low';
      };

      // ===== Business health warning (unchanged logic) =====
      // Compare last completed month vs the one before it, from March onward.
      const currentMonth = now.getMonth();

      let businessHealthWarning = false;
      let warningMessage = '';

      if (currentMonth >= 2) {
        const lastMonthData = businessHealthMonths[currentMonth - 1];
        const prevMonthData = businessHealthMonths[currentMonth - 2];

        if (lastMonthData && prevMonthData &&
            lastMonthData.totalRevenue > 0 && prevMonthData.totalRevenue > 0) {
          const discountsUp = lastMonthData.avgDiscountPercent > prevMonthData.avgDiscountPercent;
          const profitDown = lastMonthData.netProfit < prevMonthData.netProfit;

          if (discountsUp && profitDown) {
            businessHealthWarning = true;
            warningMessage = `בחודש ${lastMonthData.month} ההנחות עלו והרווח הנטו ירד לעומת ${prevMonthData.month}`;
          }
        }
      }

      // ===== Overall severities (unchanged) =====
      const lowMarginMaxSeverity: InsightSeverity = lowMarginItems.length > 0
        ? getLowMarginSeverity(Math.min(...lowMarginItems.map(i => i.marginPercent)))
        : 'low';

      const highDiscountMaxSeverity: InsightSeverity = highDiscountItems.length > 0
        ? getHighDiscountSeverity(Math.max(...highDiscountItems.map(i => i.avgDiscountPercent)))
        : 'low';

      const deadStockSeverity: InsightSeverity = deadStockItems.length > 5 ? 'high' : deadStockItems.length > 0 ? 'medium' : 'low';

      const stockoutMaxSeverity: InsightSeverity = stockoutRiskItems.length > 0
        ? getStockoutSeverity(Math.min(...stockoutRiskItems.map(i => i.daysCover)))
        : 'low';

      const costSpikeMaxSeverity: InsightSeverity = costSpikeItems.length > 0
        ? getCostSpikeSeverity(Math.max(...costSpikeItems.map(i => i.changePercent)))
        : 'low';

      const businessHealthSeverity: InsightSeverity = businessHealthWarning ? 'high' : 'low';

      return {
        lowMargin: {
          type: 'low_margin',
          title: 'רווחיות נמוכה',
          summary: lowMarginItems.length > 0
            ? `${lowMarginItems.length} מוצרים עם רווחיות נמוכה או הפסד`
            : 'כל המוצרים ברווחיות תקינה',
          severity: lowMarginMaxSeverity,
          count: lowMarginItems.length,
          updatedAt: now,
          items: lowMarginItems,
        },
        highDiscount: {
          type: 'high_discount',
          title: 'הנחות חריגות',
          summary: highDiscountItems.length > 0
            ? `${highDiscountItems.length} מוצרים עם הנחה ממוצעת מעל ${config.highDiscountPercent}%`
            : 'אין הנחות חריגות',
          severity: highDiscountMaxSeverity,
          count: highDiscountItems.length,
          updatedAt: now,
          items: highDiscountItems,
        },
        deadStock: {
          type: 'dead_stock',
          title: 'מלאי מת',
          summary: deadStockItems.length > 0
            ? `${deadStockItems.length} מוצרים לא נמכרו מעל ${config.deadStockDays} יום`
            : 'אין מלאי מת',
          severity: deadStockSeverity,
          count: deadStockItems.length,
          updatedAt: now,
          items: deadStockItems,
        },
        stockoutRisk: {
          type: 'stockout_risk',
          title: 'סיכון חוסר מלאי',
          summary: stockoutRiskItems.length > 0
            ? `${stockoutRiskItems.length} מוצרים בסיכון להיגמר תוך ${config.stockoutDaysCoverThreshold} ימים`
            : 'אין מוצרים בסיכון',
          severity: stockoutMaxSeverity,
          count: stockoutRiskItems.length,
          updatedAt: now,
          items: stockoutRiskItems,
        },
        costSpike: {
          type: 'cost_spike',
          title: 'התייקרות קנייה',
          summary: costSpikeItems.length > 0
            ? `${costSpikeItems.length} מוצרים עם עליית עלות מעל ${config.costIncreasePercent}%`
            : 'אין התייקרויות חריגות',
          severity: costSpikeMaxSeverity,
          count: costSpikeItems.length,
          updatedAt: now,
          items: costSpikeItems,
        },
        businessHealth: {
          type: 'business_health',
          title: 'בריאות עסקית',
          summary: businessHealthWarning ? warningMessage : 'המגמות העסקיות תקינות',
          severity: businessHealthSeverity,
          count: businessHealthMonths.filter(m => m.totalRevenue > 0).length,
          updatedAt: now,
          items: businessHealthMonths,
          warning: businessHealthWarning,
          warningMessage,
        },
      };
    },
    enabled: !!businessContext?.business_id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    insights,
    isLoading,
    error,
    hasData: insights != null,
  };
};
