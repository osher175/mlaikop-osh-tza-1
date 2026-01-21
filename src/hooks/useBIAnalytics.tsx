import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

interface SalesData {
  month: string;
  revenue: number;      // הכנסות מ-sale_total_ils
  purchases: number;    // הוצאות מ-purchase_total_ils
  grossProfit: number;  // רווח גולמי
  discounts: number;    // סכום הנחות
}

interface TopProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  profit: number;
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
  totalPurchases: number;
  grossProfit: number;
  totalDiscounts: number;
  avgDiscountPercent: number;
}

export const useBIAnalytics = () => {
  const { businessContext } = useBusinessAccess();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['bi-analytics-real', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return null;

      console.log('Fetching REAL BI analytics for business:', businessContext.business_id);

      // Fetch inventory actions with product and supplier details
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
          products(id, name, price, cost, supplier_id, suppliers(id, name))
        `)
        .eq('business_id', businessContext.business_id)
        .order('timestamp', { ascending: false });

      if (actionsError) {
        console.error('Error fetching inventory actions:', actionsError);
        throw actionsError;
      }

      console.log('Inventory actions fetched:', inventoryActions?.length || 0);

      // Check if we have any REAL sale/purchase data (with financial info)
      const hasSaleData = inventoryActions?.some(a => a.action_type === 'sale' && a.sale_total_ils != null);
      const hasPurchaseData = inventoryActions?.some(a => a.action_type === 'purchase' && a.purchase_total_ils != null);
      const hasRealData = hasSaleData || hasPurchaseData;

      const currentYear = new Date().getFullYear();
      const monthNames = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];

      // Calculate monthly data from REAL transactions only
      const salesData: SalesData[] = [];
      
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1);
        const monthEnd = new Date(currentYear, month + 1, 0);
        
        // Filter sales for current month
        const monthlySales = inventoryActions?.filter(action => {
          if (action.action_type !== 'sale' || action.sale_total_ils == null) return false;
          const actionDate = new Date(action.timestamp);
          return actionDate >= monthStart && actionDate <= monthEnd;
        }) || [];

        // Filter purchases for current month
        const monthlyPurchases = inventoryActions?.filter(action => {
          if (action.action_type !== 'purchase' || action.purchase_total_ils == null) return false;
          const actionDate = new Date(action.timestamp);
          return actionDate >= monthStart && actionDate <= monthEnd;
        }) || [];

        // Calculate revenue from actual sales
        const revenue = monthlySales.reduce((sum, action) => {
          return sum + (Number(action.sale_total_ils) || 0);
        }, 0);

        // Calculate purchases from actual data
        const purchases = monthlyPurchases.reduce((sum, action) => {
          return sum + (Number(action.purchase_total_ils) || 0);
        }, 0);

        // Calculate gross profit from sales (sale_total - cost_snapshot * quantity)
        const grossProfit = monthlySales.reduce((sum, action) => {
          const saleAmount = Number(action.sale_total_ils) || 0;
          const costAmount = (Number(action.cost_snapshot_ils) || 0) * Math.abs(action.quantity_changed || 0);
          return sum + (saleAmount - costAmount);
        }, 0);

        // Calculate total discounts
        const discounts = monthlySales.reduce((sum, action) => {
          return sum + (Number(action.discount_ils) || 0);
        }, 0);

        salesData.push({
          month: monthNames[month],
          revenue: Math.round(revenue * 100) / 100,
          purchases: Math.round(purchases * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          discounts: Math.round(discounts * 100) / 100,
        });
      }

      // Top products by actual sales revenue
      const productSales: Record<string, { 
        name: string; 
        quantity: number; 
        revenue: number; 
        profit: number;
      }> = {};
      
      inventoryActions?.forEach(action => {
        if (action.action_type === 'sale' && action.sale_total_ils != null) {
          const product = action.products as any;
          if (product) {
            const productId = product.id;
            const revenue = Number(action.sale_total_ils) || 0;
            const cost = (Number(action.cost_snapshot_ils) || 0) * Math.abs(action.quantity_changed || 0);
            const profit = revenue - cost;
            
            if (!productSales[productId]) {
              productSales[productId] = { name: product.name, quantity: 0, revenue: 0, profit: 0 };
            }
            productSales[productId].quantity += Math.abs(action.quantity_changed || 0);
            productSales[productId].revenue += revenue;
            productSales[productId].profit += profit;
          }
        }
      });

      const topProducts: TopProduct[] = Object.entries(productSales)
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          quantity: data.quantity,
          revenue: Math.round(data.revenue * 100) / 100,
          profit: Math.round(data.profit * 100) / 100,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Supplier purchase data from actual purchases
      const supplierPurchases: Record<string, { 
        name: string; 
        volume: number; 
        total: number;
      }> = {};
      
      inventoryActions?.forEach(action => {
        if (action.action_type === 'purchase' && action.purchase_total_ils != null) {
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
        const monthEnd = new Date(currentYear, month + 1, 0);
        
        const monthlyAdditions = inventoryActions?.filter(action => {
          if (action.action_type !== 'purchase' || action.purchase_total_ils == null) return false;
          const actionDate = new Date(action.timestamp);
          return actionDate >= monthStart && actionDate <= monthEnd;
        }) || [];

        const productPurchases: Record<string, { name: string; quantity: number; total: number }> = {};
        
        monthlyAdditions.forEach(action => {
          const product = action.products as any;
          if (product && action.quantity_changed) {
            const productId = product.id;
            const quantity = action.quantity_changed;
            const total = Number(action.purchase_total_ils) || 0;
            
            if (!productPurchases[productId]) {
              productPurchases[productId] = { name: product.name, quantity: 0, total: 0 };
            }
            productPurchases[productId].quantity += quantity;
            productPurchases[productId].total += total;
          }
        });

        const topMonthlyProduct = Object.entries(productPurchases)
          .sort(([,a], [,b]) => b.total - a.total)[0];

        monthlyPurchases.push({
          month: monthNames[month],
          productName: topMonthlyProduct?.[1]?.name || 'אין נתונים',
          quantity: topMonthlyProduct?.[1]?.quantity || 0,
          totalCost: topMonthlyProduct?.[1]?.total || 0,
        });
      }

      // Calculate overall metrics
      const totalRevenue = salesData.reduce((sum, m) => sum + m.revenue, 0);
      const totalPurchases = salesData.reduce((sum, m) => sum + m.purchases, 0);
      const grossProfit = salesData.reduce((sum, m) => sum + m.grossProfit, 0);
      const totalDiscounts = salesData.reduce((sum, m) => sum + m.discounts, 0);
      
      // Calculate average discount percent from actual sales
      const salesWithDiscount = inventoryActions?.filter(a => 
        a.action_type === 'sale' && a.discount_percent != null && a.discount_percent > 0
      ) || [];
      const avgDiscountPercent = salesWithDiscount.length > 0
        ? salesWithDiscount.reduce((sum, a) => sum + (Number(a.discount_percent) || 0), 0) / salesWithDiscount.length
        : 0;

      const metrics: AnalyticsMetrics = {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalPurchases: Math.round(totalPurchases * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
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
