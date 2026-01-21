
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import type { Database } from '@/integrations/supabase/types';

type InventoryAction = Database['public']['Tables']['inventory_actions']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface SalesData {
  month: string;
  grossRevenue: number;
  netRevenue: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

interface SupplierData {
  supplierId: string;
  supplierName: string;
  purchaseVolume: number;
  percentage: number;
}

interface MonthlyPurchase {
  month: string;
  productName: string;
  quantity: number;
}

interface DiscountSummary {
  totalDiscountIls: number;
  averageDiscountPercent: number;
  discountCount: number;
}

interface AnalyticsResult {
  salesData: SalesData[];
  topProducts: TopProduct[];
  supplierData: SupplierData[];
  monthlyPurchases: MonthlyPurchase[];
  discountSummary: DiscountSummary;
  hasData: boolean;
  hasSaleData: boolean;
  hasPurchaseData: boolean;
  totalGrossProfit: number;
  totalRevenue: number;
  totalPurchases: number;
}

export const useBIAnalytics = () => {
  const { businessContext } = useBusinessAccess();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['bi-analytics', businessContext?.business_id],
    queryFn: async (): Promise<AnalyticsResult | null> => {
      if (!businessContext?.business_id) return null;

      console.log('Fetching BI analytics for business:', businessContext.business_id);

      // Fetch inventory actions with product and supplier details
      const { data: inventoryActions, error: actionsError } = await supabase
        .from('inventory_actions')
        .select(`
          *,
          products(id, name, price, cost, supplier_id, suppliers(id, name))
        `)
        .eq('business_id', businessContext.business_id)
        .order('timestamp', { ascending: false });

      if (actionsError) {
        console.error('Error fetching inventory actions:', actionsError);
        throw actionsError;
      }

      console.log('Inventory actions fetched:', inventoryActions?.length || 0);

      const hasData = inventoryActions && inventoryActions.length > 0;
      
      // Filter by action type: 'remove' = sales, 'add' = purchases
      const salesActions = inventoryActions?.filter(a => a.action_type === 'remove') || [];
      const purchaseActions = inventoryActions?.filter(a => a.action_type === 'add') || [];
      
      const hasSaleData = salesActions.length > 0;
      const hasPurchaseData = purchaseActions.length > 0;

      // Generate monthly revenue data for current year from REAL sales data
      const currentYear = new Date().getFullYear();
      const monthNames = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];

      const salesData: SalesData[] = [];
      let totalRevenue = 0;
      let totalGrossProfit = 0;
      
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1);
        const monthEnd = new Date(currentYear, month + 1, 0);
        
        // Filter SALES for current month (action_type = 'remove')
        const monthlySales = salesActions.filter(action => {
          const actionDate = new Date(action.timestamp || '');
          return actionDate >= monthStart && actionDate <= monthEnd;
        });

        // Calculate revenue from ACTUAL sale_total_ils field
        let grossRevenue = 0;
        let monthlyGrossProfit = 0;
        
        monthlySales.forEach(action => {
          // Use real financial data from inventory_actions
          const saleTotalIls = Number(action.sale_total_ils) || 0;
          const costSnapshotIls = Number(action.cost_snapshot_ils) || 0;
          const quantitySold = Math.abs(action.quantity_changed || 0);
          
          grossRevenue += saleTotalIls;
          monthlyGrossProfit += saleTotalIls - (costSnapshotIls * quantitySold);
        });

        totalRevenue += grossRevenue;
        totalGrossProfit += monthlyGrossProfit;

        const netRevenue = grossRevenue / 1.18; // Remove 18% VAT

        salesData.push({
          month: monthNames[month],
          grossRevenue: Math.round(grossRevenue),
          netRevenue: Math.round(netRevenue)
        });
      }

      // Top 5 products by SALES revenue (action_type = 'remove')
      const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
      
      salesActions.forEach(action => {
        const product = action.products as any;
        if (product) {
          const productId = product.id;
          const quantity = Math.abs(action.quantity_changed || 0);
          const revenue = Number(action.sale_total_ils) || 0;
          
          if (!productSales[productId]) {
            productSales[productId] = { name: product.name, quantity: 0, revenue: 0 };
          }
          productSales[productId].quantity += quantity;
          productSales[productId].revenue += revenue;
        }
      });

      const topProducts: TopProduct[] = Object.entries(productSales)
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          quantity: data.quantity,
          revenue: data.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Supplier purchase data (action_type = 'add' with supplier_id)
      const supplierPurchases: Record<string, { name: string; volume: number; totalCost: number }> = {};
      let totalPurchases = 0;
      
      purchaseActions.forEach(action => {
        const purchaseTotalIls = Number(action.purchase_total_ils) || 0;
        totalPurchases += purchaseTotalIls;
        
        // Get supplier from action or from product
        const supplierId = action.supplier_id;
        const product = action.products as any;
        const supplier = product?.suppliers;
        
        if (supplierId && supplier) {
          const volume = Math.abs(action.quantity_changed || 0);
          
          if (!supplierPurchases[supplierId]) {
            supplierPurchases[supplierId] = { name: supplier.name, volume: 0, totalCost: 0 };
          }
          supplierPurchases[supplierId].volume += volume;
          supplierPurchases[supplierId].totalCost += purchaseTotalIls;
        }
      });

      const totalPurchaseVolume = Object.values(supplierPurchases).reduce((sum, s) => sum + s.volume, 0);
      
      const supplierData: SupplierData[] = Object.entries(supplierPurchases)
        .map(([supplierId, data]) => ({
          supplierId,
          supplierName: data.name,
          purchaseVolume: data.volume,
          percentage: totalPurchaseVolume > 0 ? Math.round((data.volume / totalPurchaseVolume) * 100) : 0
        }))
        .sort((a, b) => b.purchaseVolume - a.purchaseVolume);

      // Monthly purchases by product (action_type = 'add')
      const monthlyPurchases: MonthlyPurchase[] = [];
      
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1);
        const monthEnd = new Date(currentYear, month + 1, 0);
        
        const monthlyPurchaseActions = purchaseActions.filter(action => {
          const actionDate = new Date(action.timestamp || '');
          return actionDate >= monthStart && actionDate <= monthEnd;
        });

        // Find the product with highest purchase volume for this month
        const productPurchasesMap: Record<string, { name: string; quantity: number }> = {};
        
        monthlyPurchaseActions.forEach(action => {
          const product = action.products as any;
          if (product && action.quantity_changed) {
            const productId = product.id;
            const quantity = Math.abs(action.quantity_changed);
            
            if (!productPurchasesMap[productId]) {
              productPurchasesMap[productId] = { name: product.name, quantity: 0 };
            }
            productPurchasesMap[productId].quantity += quantity;
          }
        });

        const topMonthlyProduct = Object.entries(productPurchasesMap)
          .sort(([,a], [,b]) => b.quantity - a.quantity)[0];

        monthlyPurchases.push({
          month: monthNames[month],
          productName: topMonthlyProduct?.[1]?.name || 'אין נתונים',
          quantity: topMonthlyProduct?.[1]?.quantity || 0
        });
      }

      // Calculate discount summary from REAL sales data
      let totalDiscountIls = 0;
      let totalDiscountPercent = 0;
      let discountCount = 0;

      salesActions.forEach(action => {
        const discountIls = Number(action.discount_ils) || 0;
        const discountPercent = Number(action.discount_percent) || 0;
        
        if (discountIls > 0) {
          totalDiscountIls += discountIls;
          totalDiscountPercent += discountPercent;
          discountCount++;
        }
      });

      const discountSummary: DiscountSummary = {
        totalDiscountIls: Math.round(totalDiscountIls),
        averageDiscountPercent: discountCount > 0 ? Math.round(totalDiscountPercent / discountCount * 10) / 10 : 0,
        discountCount
      };

      return {
        salesData,
        topProducts,
        supplierData,
        monthlyPurchases,
        discountSummary,
        hasData,
        hasSaleData,
        hasPurchaseData,
        totalGrossProfit: Math.round(totalGrossProfit),
        totalRevenue: Math.round(totalRevenue),
        totalPurchases: Math.round(totalPurchases)
      };
    },
    enabled: !!businessContext?.business_id,
  });

  return {
    analytics,
    isLoading,
  };
};
