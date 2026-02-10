import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { 
  calculateNetFromGross,
  MONTH_NAMES_HE,
  getEffectiveFinancialStartDate,
  getYearEnd,
} from '@/lib/financialConfig';

interface SalesData {
  month: string;
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

export const useBIAnalytics = () => {
  const { businessContext } = useBusinessAccess();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['bi-analytics-real', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return null;

      const currentYear = new Date().getFullYear();
      const effectiveStart = getEffectiveFinancialStartDate(currentYear);
      const yearEnd = getYearEnd(currentYear);
      
      console.log('Fetching REAL BI analytics for business:', businessContext.business_id, 
        'Year:', currentYear, 
        'From:', effectiveStart.toISOString(), 
        'To:', yearEnd.toISOString());

      // Server-side filtering for better performance
      const { data: inventoryActions, error: actionsError } = await supabase
        .from('inventory_actions')
        .select(`
          id,
          action_type,
          quantity_changed,
          timestamp,
          notes,
          currency,
          sale_total_ils,
          sale_unit_ils,
          list_unit_ils,
          discount_ils,
          discount_percent,
          cost_snapshot_ils,
          purchase_unit_ils,
          purchase_total_ils,
          supplier_id,
          products(id, name, price, cost, supplier_id, suppliers!supplier_id(id, name))
        `)
        .eq('business_id', businessContext.business_id)
        .gte('timestamp', effectiveStart.toISOString())
        .lte('timestamp', yearEnd.toISOString())
        .order('timestamp', { ascending: false });

      if (actionsError) {
        console.error('Error fetching inventory actions:', actionsError);
        throw actionsError;
      }

      const financialActions = inventoryActions || [];
      console.log('Financial actions fetched (server-side filtered):', financialActions.length);

      // Check if we have any REAL sale/purchase data (with financial info)
      // Support both 'remove' and 'sale' action types for sales
      const hasSaleData = financialActions.some(a => 
        (a.action_type === 'remove' || a.action_type === 'sale') && a.sale_total_ils != null
      );
      const hasPurchaseData = financialActions.some(a => (a.action_type === 'add' || a.action_type === 'purchase') && a.purchase_total_ils != null);
      const hasRealData = hasSaleData || hasPurchaseData;

      // Calculate monthly data from REAL transactions only
      const salesData: SalesData[] = [];
      
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1);
        const monthEnd = new Date(currentYear, month + 1, 0, 23, 59, 59);
        
        // Filter sales for current month (action_type = 'remove' or 'sale')
        const monthlySales = financialActions.filter(action => {
          if ((action.action_type !== 'remove' && action.action_type !== 'sale') || action.sale_total_ils == null) return false;
          const actionDate = new Date(action.timestamp);
          return actionDate >= monthStart && actionDate <= monthEnd;
        });

        // Filter purchases for current month (action_type = 'add')
        const monthlyPurchasesData = financialActions.filter(action => {
          if ((action.action_type !== 'add' && action.action_type !== 'purchase') || action.purchase_total_ils == null) return false;
          const actionDate = new Date(action.timestamp);
          return actionDate >= monthStart && actionDate <= monthEnd;
        });

        // Calculate revenue from actual sales (gross - includes VAT)
        const revenue = monthlySales.reduce((sum, action) => {
          return sum + (Number(action.sale_total_ils) || 0);
        }, 0);

        // CORRECT: Calculate net revenue (without VAT) = revenue / 1.18
        const revenueNet = calculateNetFromGross(revenue);

        // Calculate purchases from actual data
        const purchases = monthlyPurchasesData.reduce((sum, action) => {
          return sum + (Number(action.purchase_total_ils) || 0);
        }, 0);

        // COGS (Cost of Goods Sold) - already without VAT
        const cogs = monthlySales.reduce((sum, action) => {
          return sum + (Number(action.cost_snapshot_ils) || 0) * Math.abs(action.quantity_changed || 0);
        }, 0);

        // Gross profit (mixed - revenue with VAT minus COGS without VAT)
        const grossProfit = revenue - cogs;

        // CORRECT: Net profit = revenueNet - COGS (both without VAT)
        const netProfit = revenueNet - cogs;

        // Calculate total discounts
        const discounts = monthlySales.reduce((sum, action) => {
          return sum + (Number(action.discount_ils) || 0);
        }, 0);

        salesData.push({
          month: MONTH_NAMES_HE[month],
          revenue: Math.round(revenue * 100) / 100,
          revenueNet: Math.round(revenueNet * 100) / 100,
          purchases: Math.round(purchases * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          netProfit: Math.round(netProfit * 100) / 100,
          discounts: Math.round(discounts * 100) / 100,
        });
      }

      // Top products by actual sales revenue
      const productSales: Record<string, { 
        name: string; 
        quantity: number; 
        revenue: number; 
        cogs: number;
      }> = {};
      
      financialActions.forEach(action => {
        if ((action.action_type === 'remove' || action.action_type === 'sale') && action.sale_total_ils != null) {
          const product = action.products as any;
          if (product) {
            const productId = product.id;
            const revenue = Number(action.sale_total_ils) || 0;
            const cost = (Number(action.cost_snapshot_ils) || 0) * Math.abs(action.quantity_changed || 0);
            
            if (!productSales[productId]) {
              productSales[productId] = { name: product.name, quantity: 0, revenue: 0, cogs: 0 };
            }
            productSales[productId].quantity += Math.abs(action.quantity_changed || 0);
            productSales[productId].revenue += revenue;
            productSales[productId].cogs += cost;
          }
        }
      });

      const topProducts: TopProduct[] = Object.entries(productSales)
        .map(([productId, data]) => {
          const revenueNet = calculateNetFromGross(data.revenue);
          const profit = data.revenue - data.cogs; // gross profit (mixed)
          const profitNet = revenueNet - data.cogs; // net profit (correct)
          
          return {
            productId,
            productName: data.name,
            quantity: data.quantity,
            revenue: Math.round(data.revenue * 100) / 100,
            revenueNet: Math.round(revenueNet * 100) / 100,
            profit: Math.round(profit * 100) / 100,
            profitNet: Math.round(profitNet * 100) / 100,
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Supplier purchase data from actual purchases
      const supplierPurchases: Record<string, { 
        name: string; 
        volume: number; 
        total: number;
      }> = {};
      
      financialActions.forEach(action => {
        if ((action.action_type === 'add' || action.action_type === 'purchase') && action.purchase_total_ils != null) {
          const product = action.products as any;
          const supplier = product?.suppliers || (action.supplier_id ? { id: action.supplier_id, name: 'ספק לא ידוע' } : null);
          
          if (supplier) {
            const supplierId = supplier.id;
            const volume = action.quantity_changed || 0;
            const total = Number(action.purchase_total_ils) || 0;
            
            if (!supplierPurchases[supplierId]) {
              supplierPurchases[supplierId] = { name: supplier.name || 'ספק לא ידוע', volume: 0, total: 0 };
            }
            supplierPurchases[supplierId].volume += volume;
            supplierPurchases[supplierId].total += total;
          }
        }
      });

      const totalPurchaseVolume = Object.values(supplierPurchases).reduce((sum, s) => sum + s.volume, 0);
      
      const supplierData: SupplierData[] = Object.entries(supplierPurchases)
        .map(([supplierId, data]) => ({
          supplierId,
          supplierName: data.name,
          purchaseVolume: data.volume,
          purchaseTotal: Math.round(data.total * 100) / 100,
          percentage: totalPurchaseVolume > 0 ? Math.round((data.volume / totalPurchaseVolume) * 100) : 0,
        }))
        .sort((a, b) => b.purchaseTotal - a.purchaseTotal);

      // Monthly purchases by product
      const monthlyPurchases: MonthlyPurchase[] = [];
      
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1);
        const monthEnd = new Date(currentYear, month + 1, 0, 23, 59, 59);
        
        const monthlyAdditions = financialActions.filter(action => {
          if ((action.action_type !== 'add' && action.action_type !== 'purchase') || action.purchase_total_ils == null) return false;
          const actionDate = new Date(action.timestamp);
          return actionDate >= monthStart && actionDate <= monthEnd;
        });

        const productPurchasesMap: Record<string, { name: string; quantity: number; total: number }> = {};
        
        monthlyAdditions.forEach(action => {
          const product = action.products as any;
          if (product && action.quantity_changed) {
            const productId = product.id;
            const quantity = action.quantity_changed;
            const total = Number(action.purchase_total_ils) || 0;
            
            if (!productPurchasesMap[productId]) {
              productPurchasesMap[productId] = { name: product.name, quantity: 0, total: 0 };
            }
            productPurchasesMap[productId].quantity += quantity;
            productPurchasesMap[productId].total += total;
          }
        });

        const topMonthlyProduct = Object.entries(productPurchasesMap)
          .sort(([,a], [,b]) => b.total - a.total)[0];

        monthlyPurchases.push({
          month: MONTH_NAMES_HE[month],
          productName: topMonthlyProduct?.[1]?.name || 'אין נתונים',
          quantity: topMonthlyProduct?.[1]?.quantity || 0,
          totalCost: topMonthlyProduct?.[1]?.total || 0,
        });
      }

      // Calculate overall metrics
      const totalRevenue = salesData.reduce((sum, m) => sum + m.revenue, 0);
      const totalRevenueNet = salesData.reduce((sum, m) => sum + m.revenueNet, 0);
      const totalPurchases = salesData.reduce((sum, m) => sum + m.purchases, 0);
      const grossProfit = salesData.reduce((sum, m) => sum + m.grossProfit, 0);
      const netProfit = salesData.reduce((sum, m) => sum + m.netProfit, 0);
      const totalDiscounts = salesData.reduce((sum, m) => sum + m.discounts, 0);
      
      // Calculate average discount percent from actual sales
      const salesWithDiscount = financialActions.filter(a => 
        (a.action_type === 'remove' || a.action_type === 'sale') && a.discount_percent != null && a.discount_percent > 0
      );
      const avgDiscountPercent = salesWithDiscount.length > 0
        ? salesWithDiscount.reduce((sum, a) => sum + (Number(a.discount_percent) || 0), 0) / salesWithDiscount.length
        : 0;

      const metrics: AnalyticsMetrics = {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalRevenueNet: Math.round(totalRevenueNet * 100) / 100,
        totalPurchases: Math.round(totalPurchases * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        totalDiscounts: Math.round(totalDiscounts * 100) / 100,
        avgDiscountPercent: Math.round(avgDiscountPercent * 100) / 100,
      };

      return {
        salesData,
        topProducts,
        supplierData,
        monthlyPurchases,
        metrics,
        hasData: hasRealData,
        hasSaleData,
        hasPurchaseData,
        currentYear,
      };
    },
    enabled: !!businessContext?.business_id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    analytics,
    isLoading,
  };
};
