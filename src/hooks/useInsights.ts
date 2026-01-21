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

interface InventoryAction {
  id: string;
  action_type: string;
  quantity_changed: number;
  timestamp: string;
  sale_total_ils: number | null;
  sale_unit_ils: number | null;
  list_unit_ils: number | null;
  discount_ils: number | null;
  discount_percent: number | null;
  cost_snapshot_ils: number | null;
  purchase_unit_ils: number | null;
  purchase_total_ils: number | null;
  supplier_id: string | null;
  products: {
    id: string;
    name: string;
    quantity: number;
    price: number | null;
    cost: number | null;
    supplier_id: string | null;
    suppliers?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

interface Product {
  id: string;
  name: string;
  quantity: number;
  price: number | null;
  cost: number | null;
}

export const useInsights = (config: InsightsConfig = DEFAULT_INSIGHTS_CONFIG) => {
  const { businessContext } = useBusinessAccess();

  // Stringify config for stable queryKey (Fix #2)
  const configKey = JSON.stringify(config);

  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['insights', businessContext?.business_id, configKey],
    queryFn: async (): Promise<InsightsData | null> => {
      if (!businessContext?.business_id) return null;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - config.lookbackSalesDays * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - config.lookbackPurchasesDays * 24 * 60 * 60 * 1000);

      // Fetch inventory actions for the lookback period (90 days for purchases, 30 for sales)
      const { data: actions, error: actionsError } = await supabase
        .from('inventory_actions')
        .select(`
          id,
          action_type,
          quantity_changed,
          timestamp,
          sale_total_ils,
          sale_unit_ils,
          list_unit_ils,
          discount_ils,
          discount_percent,
          cost_snapshot_ils,
          purchase_unit_ils,
          purchase_total_ils,
          supplier_id,
          products(id, name, quantity, price, cost, supplier_id, suppliers(id, name))
        `)
        .eq('business_id', businessContext.business_id)
        .gte('timestamp', ninetyDaysAgo.toISOString())
        .order('timestamp', { ascending: false });

      if (actionsError) {
        console.error('Error fetching inventory actions for insights:', actionsError);
        throw actionsError;
      }

      // Use aggregated RPC to get last sale date per product (prevents PostgREST row-limit truncation)
      const { data: lastSaleAggregated, error: lastSaleError } = await supabase
        .rpc('get_last_sale_at_by_product', { p_business_id: businessContext.business_id });

      if (lastSaleError) {
        console.error('Error fetching last sale dates for dead stock:', lastSaleError);
        // Continue without breaking - dead stock will show null daysSinceLastSale
      }

      // Fetch all products for dead stock and stockout analysis
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, quantity, price, cost')
        .eq('business_id', businessContext.business_id);

      if (productsError) {
        console.error('Error fetching products for insights:', productsError);
        throw productsError;
      }

      const typedActions = (actions || []) as unknown as InventoryAction[];
      const typedProducts = (products || []) as Product[];

      // Filter sales (remove) with financial data - last 30 days
      const sales30Days = typedActions.filter(a => 
        a.action_type === 'remove' && 
        a.sale_total_ils != null &&
        new Date(a.timestamp) >= thirtyDaysAgo
      );

      // Filter purchases (add) with financial data - last 90 days
      const purchases90Days = typedActions.filter(a => 
        a.action_type === 'add' && 
        (a.purchase_unit_ils != null || a.purchase_total_ils != null)
      );

      // Filter purchases last 30 days for cost spike comparison
      const purchases30Days = purchases90Days.filter(a => 
        new Date(a.timestamp) >= thirtyDaysAgo
      );

      // ============ INSIGHT A: Low Margin / Loss per Product ============
      const productProfitability: Record<string, {
        productId: string;
        productName: string;
        unitsSold: number;
        revenue: number;
        grossProfit: number;
      }> = {};

      sales30Days.forEach(action => {
        if (!action.products) return;
        const productId = action.products.id;
        const revenue = Number(action.sale_total_ils) || 0;
        const costPerUnit = Number(action.cost_snapshot_ils) || 0;
        const quantity = Math.abs(action.quantity_changed);
        const grossProfit = revenue - (costPerUnit * quantity);

        if (!productProfitability[productId]) {
          productProfitability[productId] = {
            productId,
            productName: action.products.name,
            unitsSold: 0,
            revenue: 0,
            grossProfit: 0,
          };
        }
        productProfitability[productId].unitsSold += quantity;
        productProfitability[productId].revenue += revenue;
        productProfitability[productId].grossProfit += grossProfit;
      });

      const lowMarginItems: LowMarginItem[] = Object.values(productProfitability)
        .map(p => ({
          ...p,
          marginPercent: p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0,
        }))
        .filter(p => p.marginPercent < config.lowMarginPercent || p.grossProfit < 0)
        .sort((a, b) => a.marginPercent - b.marginPercent)
        .slice(0, 10);

      const getLowMarginSeverity = (margin: number): InsightSeverity => {
        if (margin < 0) return 'high';
        if (margin < config.lowMarginPercent) return 'medium';
        return 'low';
      };

      // ============ INSIGHT B: High Discounts ============
      const productDiscounts: Record<string, {
        productId: string;
        productName: string;
        totalDiscountIls: number;
        totalDiscountPercent: number;
        salesCount: number;
      }> = {};

      sales30Days.forEach(action => {
        if (!action.products || action.discount_percent == null) return;
        const productId = action.products.id;
        const discountPercent = Number(action.discount_percent) || 0;
        const discountIls = Number(action.discount_ils) || 0;

        if (!productDiscounts[productId]) {
          productDiscounts[productId] = {
            productId,
            productName: action.products.name,
            totalDiscountIls: 0,
            totalDiscountPercent: 0,
            salesCount: 0,
          };
        }
        productDiscounts[productId].totalDiscountIls += discountIls;
        productDiscounts[productId].totalDiscountPercent += discountPercent;
        productDiscounts[productId].salesCount += 1;
      });

      const highDiscountItems: HighDiscountItem[] = Object.values(productDiscounts)
        .map(p => ({
          productId: p.productId,
          productName: p.productName,
          avgDiscountPercent: p.salesCount > 0 ? p.totalDiscountPercent / p.salesCount : 0,
          totalDiscountIls: p.totalDiscountIls,
          salesCount: p.salesCount,
        }))
        .filter(p => p.avgDiscountPercent >= config.highDiscountPercent)
        .sort((a, b) => b.avgDiscountPercent - a.avgDiscountPercent)
        .slice(0, 10);

      const getHighDiscountSeverity = (avgDiscount: number): InsightSeverity => {
        if (avgDiscount >= 35) return 'high';
        if (avgDiscount >= 25) return 'medium';
        return 'low';
      };

      // ============ INSIGHT C: Dead Stock ============
      // Use the aggregated RPC data (last sale per product from full history)
      const productLastSale: Record<string, Date | null> = {};
      
      // Build map from aggregated RPC result
      if (lastSaleAggregated && Array.isArray(lastSaleAggregated)) {
        lastSaleAggregated.forEach((row: { product_id: string; last_sale_at: string }) => {
          if (!row.product_id) return;
          productLastSale[row.product_id] = new Date(row.last_sale_at);
        });
      }

      const deadStockItems: DeadStockItem[] = typedProducts
        .filter(p => p.quantity > 0)
        .map(product => {
          const lastSale = productLastSale[product.id];
          const daysSinceLastSale = lastSale 
            ? Math.floor((now.getTime() - lastSale.getTime()) / (24 * 60 * 60 * 1000))
            : null;
          
          // FIX #5: Use cost ONLY for estimated value. If cost is missing/0, show 0 (not price)
          const costValue = Number(product.cost) || 0;
          const estimatedValue = costValue > 0 ? product.quantity * costValue : 0;

          return {
            productId: product.id,
            productName: product.name,
            quantity: product.quantity,
            daysSinceLastSale,
            estimatedValue,
          };
        })
        .filter(p => p.daysSinceLastSale === null || p.daysSinceLastSale >= config.deadStockDays)
        .sort((a, b) => {
          // Products never sold come first
          if (a.daysSinceLastSale === null && b.daysSinceLastSale === null) return 0;
          if (a.daysSinceLastSale === null) return -1;
          if (b.daysSinceLastSale === null) return 1;
          return b.daysSinceLastSale - a.daysSinceLastSale;
        })
        .slice(0, 20);

      // ============ INSIGHT D: Stockout Risk ============
      // Calculate avg daily sales per product from last 30 days
      const productSales30Days: Record<string, number> = {};
      
      sales30Days.forEach(action => {
        if (!action.products) return;
        const productId = action.products.id;
        const quantity = Math.abs(action.quantity_changed);
        productSales30Days[productId] = (productSales30Days[productId] || 0) + quantity;
      });

      const stockoutRiskItems: StockoutRiskItem[] = typedProducts
        .map(product => {
          const soldUnits = productSales30Days[product.id] || 0;
          const avgDailySales = soldUnits / 30;
          const daysCover = avgDailySales > 0 ? product.quantity / avgDailySales : Infinity;

          return {
            productId: product.id,
            productName: product.name,
            currentQuantity: product.quantity,
            avgDailySales: Math.round(avgDailySales * 100) / 100,
            daysCover: daysCover === Infinity ? 999 : Math.round(daysCover * 10) / 10,
          };
        })
        .filter(p => p.avgDailySales > 0 && p.daysCover < config.stockoutDaysCoverThreshold)
        .sort((a, b) => a.daysCover - b.daysCover)
        .slice(0, 20);

      const getStockoutSeverity = (daysCover: number): InsightSeverity => {
        if (daysCover < 3) return 'high';
        if (daysCover < 7) return 'medium';
        return 'low';
      };

      // ============ INSIGHT E: Cost Spike ============
      // Calculate avg purchase unit cost per product for 90 days and 30 days
      const productCosts90: Record<string, { total: number; count: number; supplierName?: string }> = {};
      const productCosts30: Record<string, { total: number; count: number }> = {};
      const productNames: Record<string, string> = {};

      purchases90Days.forEach(action => {
        if (!action.products) return;
        const productId = action.products.id;
        const unitCost = Number(action.purchase_unit_ils) || 
          (action.purchase_total_ils ? Number(action.purchase_total_ils) / Math.abs(action.quantity_changed) : 0);
        
        if (unitCost <= 0) return;

        productNames[productId] = action.products.name;
        
        if (!productCosts90[productId]) {
          productCosts90[productId] = { total: 0, count: 0 };
        }
        productCosts90[productId].total += unitCost;
        productCosts90[productId].count += 1;
        
        if (action.products.suppliers?.name) {
          productCosts90[productId].supplierName = action.products.suppliers.name;
        }
      });

      purchases30Days.forEach(action => {
        if (!action.products) return;
        const productId = action.products.id;
        const unitCost = Number(action.purchase_unit_ils) || 
          (action.purchase_total_ils ? Number(action.purchase_total_ils) / Math.abs(action.quantity_changed) : 0);
        
        if (unitCost <= 0) return;

        if (!productCosts30[productId]) {
          productCosts30[productId] = { total: 0, count: 0 };
        }
        productCosts30[productId].total += unitCost;
        productCosts30[productId].count += 1;
      });

      const costSpikeItems: CostSpikeItem[] = Object.keys(productCosts90)
        .filter(productId => productCosts30[productId]?.count > 0)
        .map(productId => {
          const avg90 = productCosts90[productId].total / productCosts90[productId].count;
          const avg30 = productCosts30[productId].total / productCosts30[productId].count;
          const changePercent = ((avg30 - avg90) / avg90) * 100;

          return {
            productId,
            productName: productNames[productId],
            avgCost90Days: Math.round(avg90 * 100) / 100,
            avgCost30Days: Math.round(avg30 * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
            supplierName: productCosts90[productId].supplierName,
          };
        })
        .filter(p => p.changePercent >= config.costIncreasePercent)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 10);

      const getCostSpikeSeverity = (changePercent: number): InsightSeverity => {
        if (changePercent >= 20) return 'high';
        if (changePercent >= 10) return 'medium';
        return 'low';
      };

      // ============ INSIGHT F: Business Health Monthly ============
      const currentYear = now.getFullYear();
      const monthNames = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];

      // All sales this year
      const yearStart = new Date(currentYear, 0, 1);
      const allSalesThisYear = typedActions.filter(a => 
        a.action_type === 'remove' && 
        a.sale_total_ils != null &&
        new Date(a.timestamp) >= yearStart
      );

      const businessHealthMonths: BusinessHealthMonth[] = [];
      
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1);
        const monthEnd = new Date(currentYear, month + 1, 0, 23, 59, 59);
        
        const monthlySales = allSalesThisYear.filter(a => {
          const d = new Date(a.timestamp);
          return d >= monthStart && d <= monthEnd;
        });

        const totalRevenue = monthlySales.reduce((sum, a) => sum + (Number(a.sale_total_ils) || 0), 0);
        const totalDiscounts = monthlySales.reduce((sum, a) => sum + (Number(a.discount_ils) || 0), 0);
        const grossProfit = monthlySales.reduce((sum, a) => {
          const revenue = Number(a.sale_total_ils) || 0;
          const cost = (Number(a.cost_snapshot_ils) || 0) * Math.abs(a.quantity_changed);
          return sum + (revenue - cost);
        }, 0);
        
        const discountPercentSum = monthlySales.reduce((sum, a) => sum + (Number(a.discount_percent) || 0), 0);
        const avgDiscountPercent = monthlySales.length > 0 ? discountPercentSum / monthlySales.length : 0;

        businessHealthMonths.push({
          month: monthNames[month],
          monthIndex: month,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalDiscounts: Math.round(totalDiscounts * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          avgDiscountPercent: Math.round(avgDiscountPercent * 100) / 100,
        });
      }

      // FIX #4: Check for warning: last month discounts up AND gross profit down vs previous month
      // Only compare if we're past February and both months are in the same year
      const currentMonth = now.getMonth();
      
      let businessHealthWarning = false;
      let warningMessage = '';
      
      // Only do comparison if we have at least 2 months of data (March or later)
      if (currentMonth >= 2) {
        const lastMonthData = businessHealthMonths[currentMonth - 1];
        const prevMonthData = businessHealthMonths[currentMonth - 2];
        
        if (lastMonthData && prevMonthData && 
            lastMonthData.totalRevenue > 0 && prevMonthData.totalRevenue > 0) {
          const discountsUp = lastMonthData.avgDiscountPercent > prevMonthData.avgDiscountPercent;
          const profitDown = lastMonthData.grossProfit < prevMonthData.grossProfit;
          
          if (discountsUp && profitDown) {
            businessHealthWarning = true;
            warningMessage = `בחודש ${lastMonthData.month} ההנחות עלו והרווח הגולמי ירד לעומת ${prevMonthData.month}`;
          }
        }
      }

      // Determine overall severities
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
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    insights,
    isLoading,
    error,
    hasData: insights != null,
  };
};
