
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

const createEmptyAnalytics = () => {
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  const salesData: SalesData[] = monthNames.map(month => ({
    month,
    grossRevenue: 0,
    netRevenue: 0
  }));

  const monthlyPurchases: MonthlyPurchase[] = monthNames.map(month => ({
    month,
    productName: '',
    quantity: 0
  }));

  return {
    salesData,
    topProducts: [] as TopProduct[],
    supplierData: [] as SupplierData[],
    monthlyPurchases,
    hasData: false
  };
};

export const useBIAnalytics = () => {
  const { businessContext } = useBusinessAccess();

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['bi-analytics', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return createEmptyAnalytics();

      console.log('Fetching BI analytics for business:', businessContext.business_id);

      try {
        // Fetch all inventory actions with product details
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
          return createEmptyAnalytics();
        }

        console.log('Inventory actions fetched:', inventoryActions?.length || 0);

        // If no data exists, return empty structure with proper format
        if (!inventoryActions || inventoryActions.length === 0) {
          console.log('No inventory actions found, returning empty analytics');
          return createEmptyAnalytics();
        }

        const currentYear = new Date().getFullYear();
        const monthNames = [
          'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
          'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
        ];

        // Calculate monthly sales revenue (ברוטו ונטו)
        const salesData: SalesData[] = [];
        
        for (let month = 0; month < 12; month++) {
          const monthStart = new Date(currentYear, month, 1);
          const monthEnd = new Date(currentYear, month + 1, 0);
          
          const monthlySales = inventoryActions.filter(action => {
            if (action.action_type !== 'sale') return false;
            const actionDate = new Date(action.timestamp);
            return actionDate >= monthStart && actionDate <= monthEnd;
          });

          let grossRevenue = 0;
          monthlySales.forEach(sale => {
            const product = sale.products as any;
            if (product?.price && sale.quantity_changed) {
              grossRevenue += sale.quantity_changed * Number(product.price);
            }
          });

          // Calculate net revenue (ברוטו ÷ 1.18 for VAT)
          const netRevenue = grossRevenue / 1.18;

          salesData.push({
            month: monthNames[month],
            grossRevenue: Math.round(grossRevenue),
            netRevenue: Math.round(netRevenue)
          });
        }

        // Calculate top 5 products by sales
        const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
        
        inventoryActions.forEach(action => {
          if (action.action_type === 'sale' && action.quantity_changed) {
            const product = action.products as any;
            if (product) {
              const productId = product.id;
              const quantity = action.quantity_changed;
              const revenue = quantity * (Number(product.price) || 0);
              
              if (!productSales[productId]) {
                productSales[productId] = { name: product.name, quantity: 0, revenue: 0 };
              }
              productSales[productId].quantity += quantity;
              productSales[productId].revenue += revenue;
            }
          }
        });

        const topProducts: TopProduct[] = Object.entries(productSales)
          .map(([productId, data]) => ({
            productId,
            productName: data.name,
            quantity: data.quantity,
            revenue: data.revenue
          }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);

        // Calculate supplier purchase data
        const supplierPurchases: Record<string, { name: string; volume: number }> = {};
        
        inventoryActions.forEach(action => {
          if (action.action_type === 'add' && action.quantity_changed) {
            const product = action.products as any;
            const supplier = product?.suppliers;
            if (supplier) {
              const supplierId = supplier.id;
              const volume = action.quantity_changed;
              
              if (!supplierPurchases[supplierId]) {
                supplierPurchases[supplierId] = { name: supplier.name, volume: 0 };
              }
              supplierPurchases[supplierId].volume += volume;
            }
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

        // Calculate monthly purchases by product
        const monthlyPurchases: MonthlyPurchase[] = [];
        
        for (let month = 0; month < 12; month++) {
          const monthStart = new Date(currentYear, month, 1);
          const monthEnd = new Date(currentYear, month + 1, 0);
          
          const monthlyAdditions = inventoryActions.filter(action => {
            if (action.action_type !== 'add') return false;
            const actionDate = new Date(action.timestamp);
            return actionDate >= monthStart && actionDate <= monthEnd;
          });

          // Find the product with highest purchase volume for this month
          const productPurchases: Record<string, { name: string; quantity: number }> = {};
          
          monthlyAdditions.forEach(action => {
            const product = action.products as any;
            if (product && action.quantity_changed) {
              const productId = product.id;
              const quantity = action.quantity_changed;
              
              if (!productPurchases[productId]) {
                productPurchases[productId] = { name: product.name, quantity: 0 };
              }
              productPurchases[productId].quantity += quantity;
            }
          });

          const topMonthlyProduct = Object.entries(productPurchases)
            .sort(([,a], [,b]) => b.quantity - a.quantity)[0];

          if (topMonthlyProduct) {
            monthlyPurchases.push({
              month: monthNames[month],
              productName: topMonthlyProduct[1].name,
              quantity: topMonthlyProduct[1].quantity
            });
          } else {
            monthlyPurchases.push({
              month: monthNames[month],
              productName: '',
              quantity: 0
            });
          }
        }

        const hasData = inventoryActions.length > 0;
        console.log('BI Analytics calculated successfully:', { 
          salesDataLength: salesData.length, 
          topProductsLength: topProducts.length,
          supplierDataLength: supplierData.length,
          hasData 
        });

        return {
          salesData,
          topProducts,
          supplierData,
          monthlyPurchases,
          hasData
        };
      } catch (error) {
        console.error('Error in BI Analytics:', error);
        return createEmptyAnalytics();
      }
    },
    enabled: !!businessContext?.business_id,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time-like updates
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  return {
    analytics: analytics || createEmptyAnalytics(),
    isLoading,
    refetch,
  };
};
