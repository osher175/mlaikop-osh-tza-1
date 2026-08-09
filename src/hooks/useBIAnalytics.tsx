import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { MONTH_NAMES_HE } from '@/lib/financialConfig';

/**
 * BI analytics for the current financial (calendar) year.
 *
 * Phase A2.S3: all aggregation happens inside the database via the
 * `bi_analytics_yearly` RPC. Previously this hook downloaded every
 * `inventory_actions` row of the year and summed them in the browser, which
 * exceeded the PostgREST row cap (2,003 rows in the current year) and silently
 * truncated the oldest months to zero. The RPC also excludes reversed actions,
 * which the client-side version double-counted.
 *
 * Business rules are shared with `reports_aggregate` and `yoy_financials`:
 *   sales     = action_type IN ('remove','sale')  AND sale_total_ils IS NOT NULL
 *   purchases = action_type IN ('add','purchase') AND purchase_total_ils IS NOT NULL
 *   reversals excluded, Asia/Jerusalem month boundaries, VAT 18%.
 */

interface SalesData {
  month: string;          // תווית חודש בעברית
  revenue: number;        // הכנסות ברוטו (כולל מע״מ)
  revenueNet: number;     // הכנסות נטו (ללא מע״מ)
  purchases: number;      // הוצאות מ-purchase_total_ils
  grossProfit: number;    // רווח גולמי (revenue - COGS, מעורב)
  netProfit: number;      // רווח נטו = revenueNet - COGS
  discounts: number;      // סכום הנחות
}

interface TopProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  revenueNet: number;
  profit: number;
  profitNet: number;
}

interface SupplierData {
  supplierId: string;
  supplierName: string;
  purchaseVolume: number;
  purchaseTotal: number;
  percentage: number;
}

interface MonthlyPurchase {
  month: string;
  productName: string;
  quantity: number;
  totalCost: number;
}

interface AnalyticsMetrics {
  totalRevenue: number;
  totalRevenueNet: number;
  totalPurchases: number;
  grossProfit: number;
  netProfit: number;
  totalDiscounts: number;
  avgDiscountPercent: number;
}

/** Raw shape returned by the `bi_analytics_yearly` RPC (month labels resolved client-side). */
interface BiRpcPayload {
  year: number;
  salesData: Array<Omit<SalesData, 'month'> & { monthIndex: number }>;
  topProducts: TopProduct[];
  supplierData: Array<Omit<SupplierData, 'supplierName'> & { supplierName: string | null }>;
  monthlyPurchases: Array<Omit<MonthlyPurchase, 'month' | 'productName'> & {
    monthIndex: number;
    productName: string | null;
  }>;
  metrics: AnalyticsMetrics;
  hasSaleData: boolean;
  hasPurchaseData: boolean;
}

const UNKNOWN_SUPPLIER_HE = 'ספק לא ידוע';
const NO_DATA_HE = 'אין נתונים';

export const useBIAnalytics = () => {
  const { businessContext } = useBusinessAccess();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['bi-analytics-real', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return null;

      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase.rpc('bi_analytics_yearly', {
        p_business_id: businessContext.business_id,
        p_year: currentYear,
      });

      if (error) {
        console.error('Error fetching BI analytics aggregate:', error);
        throw error;
      }

      const payload = (data as unknown as BiRpcPayload | null) ?? null;
      if (!payload) return null;

      // Hebrew labels stay in the frontend; the RPC only returns month indexes.
      const salesData: SalesData[] = (payload.salesData ?? []).map(({ monthIndex, ...rest }) => ({
        ...rest,
        month: MONTH_NAMES_HE[monthIndex],
      }));

      const monthlyPurchases: MonthlyPurchase[] = (payload.monthlyPurchases ?? []).map(
        ({ monthIndex, productName, ...rest }) => ({
          ...rest,
          month: MONTH_NAMES_HE[monthIndex],
          productName: productName ?? NO_DATA_HE,
        }),
      );

      const supplierData: SupplierData[] = (payload.supplierData ?? []).map((s) => ({
        ...s,
        supplierName: s.supplierName ?? UNKNOWN_SUPPLIER_HE,
      }));

      const hasSaleData = payload.hasSaleData ?? false;
      const hasPurchaseData = payload.hasPurchaseData ?? false;

      return {
        salesData,
        topProducts: payload.topProducts ?? [],
        supplierData,
        monthlyPurchases,
        metrics: payload.metrics,
        hasData: hasSaleData || hasPurchaseData,
        hasSaleData,
        hasPurchaseData,
        currentYear,
      };
    },
    enabled: !!businessContext?.business_id,
    staleTime: 0,
    gcTime: 3 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: false,
  });

  return {
    analytics,
    isLoading,
  };
};
