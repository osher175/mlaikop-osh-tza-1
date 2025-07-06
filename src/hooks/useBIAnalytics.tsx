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

export const useBIAnalytics = () => {
  const { businessContext } = useBusinessAccess();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['bi-analytics', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return null;

      console.log('Fetching BI analytics for business:', businessContext.business_id);

      // Fetch inventory actions with product and supplier details
      const { data: inventoryActions, error: actionsError } = await supabase
        .from('inventory_actions')
        .select(`
          id,
          action_type,
          quantity_changed,
          timestamp,
          notes,
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

      // Generate monthly revenue data for 2025
      const currentYear = new Date().getFullYear();
      const monthNames = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];

      const salesData: SalesData[] = [];
      
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1);
        const monthEnd = new Date(currentYear, month + 1, 0);
        
        // Filter actions for current month - use "add" actions as revenue proxy
        const monthlyActions = inventoryActions?.filter(action => {
          if (action.action_type !== 'add') return false;
          const actionDate = new Date(action.timestamp);
          return actionDate >= monthStart && actionDate <= monthEnd;
        }) || [];

        let grossRevenue = 0;
        monthlyActions.forEach(action => {
          const product = action.products as any;
          if (product?.price && action.quantity_changed) {
            // Use quantity added as revenue indicator
            grossRevenue += Math.abs(action.quantity_changed) * Number(product.price || 100);
          }
        });

        const netRevenue = grossRevenue / 1.18; // Remove 18% VAT

        salesData.push({
          month: monthNames[month],
          grossRevenue: Math.round(grossRevenue),
          netRevenue: Math.round(netRevenue)
        });
      }

      // Top 5 products by quantity added (using "add" actions)
      const productAdditions: Record<string, { name: string; quantity: number; revenue: number }> = {};
      
      inventoryActions?.forEach(action => {
        if (action.action_type === 'add' && action.quantity_changed) {
          const product = action.products as any;
          if (product) {
            const productId = product.id;
            const quantity = Math.abs(action.quantity_changed);
            const revenue = quantity * (Number(product.price) || 100);
            
            if (!productAdditions[productId]) {
              productAdditions[productId] = { name: product.name, quantity: 0, revenue: 0 };
            }
            productAdditions[productId].quantity += quantity;
            productAdditions[productId].revenue += revenue;
          }
        }
      });

      const topProducts: TopProduct[] = Object.entries(productAdditions)
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          quantity: data.quantity,
          revenue: data.revenue
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Supplier purchase data (using "add" actions)
      const supplierPurchases: Record<string, { name: string; volume: number }> = {};
      
      inventoryActions?.forEach(action => {
        if (action.action_type === 'add' && action.quantity_changed) {
          const product = action.products as any;
          const supplier = product?.suppliers;
          if (supplier) {
            const supplierId = supplier.id;
            const volume = Math.abs(action.quantity_changed);
            
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

      // Monthly purchases by product (current month only)
      const monthlyPurchases: MonthlyPurchase[] = [];
      
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1);
        const monthEnd = new Date(currentYear, month + 1, 0);
        
        const monthlyAdditions = inventoryActions?.filter(action => {
          if (action.action_type !== 'add') return false;
          const actionDate = new Date(action.timestamp);
          return actionDate >= monthStart && actionDate <= monthEnd;
        }) || [];

        // Find the product with highest purchase volume for this month
        const productPurchases: Record<string, { name: string; quantity: number }> = {};
        
        monthlyAdditions.forEach(action => {
          const product = action.products as any;
          if (product && action.quantity_changed) {
            const productId = product.id;
            const quantity = Math.abs(action.quantity_changed);
            
            if (!productPurchases[productId]) {
              productPurchases[productId] = { name: product.name, quantity: 0 };
            }
            productPurchases[productId].quantity += quantity;
          }
        });

        const topMonthlyProduct = Object.entries(productPurchases)
          .sort(([,a], [,b]) => b.quantity - a.quantity)[0];

        monthlyPurchases.push({
          month: monthNames[month],
          productName: topMonthlyProduct?.[1]?.name || 'אין נתונים',
          quantity: topMonthlyProduct?.[1]?.quantity || 0
        });
      }

      return {
        salesData,
        topProducts,
        supplierData,
        monthlyPurchases,
        hasData
      };
    },
    enabled: !!businessContext?.business_id,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    analytics,
    isLoading,
  };
};
