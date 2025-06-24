
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusiness } from './useBusiness';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
  product_categories: { name: string } | null;
  suppliers: { name: string } | null;
};

interface ReportsFilters {
  timeRange: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  categoryId?: string;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
}

export const useReports = (filters: ReportsFilters) => {
  const { user } = useAuth();
  const { business } = useBusiness();

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['reports', user?.id, business?.id, filters],
    queryFn: async () => {
      if (!user?.id || !business?.id) return null;

      // Get products with product_categories and suppliers
      let query = supabase
        .from('products')
        .select(`
          *,
          product_categories:product_category_id(name),
          suppliers:supplier_id(name)
        `)
        .eq('business_id', business.id);

      // Apply filters
      if (filters.categoryId) {
        query = query.eq('product_category_id', filters.categoryId);
      }
      if (filters.supplierId) {
        query = query.eq('supplier_id', filters.supplierId);
      }

      const { data: products, error } = await query;
      
      if (error) throw error;

      // Calculate date range based on time range filter
      const now = new Date();
      let startDate: Date;
      
      switch (filters.timeRange) {
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'quarterly':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Mock sales data for demonstration (in real app, this would come from sales table)
      const mockSalesData = products?.map(product => ({
        ...product,
        unitsSold: Math.floor(Math.random() * 50) + 1,
        revenue: (product.price || 0) * (Math.floor(Math.random() * 50) + 1),
        profit: ((product.price || 0) - (product.cost || 0)) * (Math.floor(Math.random() * 50) + 1),
      })) || [];

      // Calculate aggregated metrics
      const totalRevenue = mockSalesData.reduce((sum, item) => sum + item.revenue, 0);
      const totalCost = mockSalesData.reduce((sum, item) => sum + (item.cost || 0) * item.unitsSold, 0);
      const totalProfit = totalRevenue - totalCost;
      const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

      // Top selling products
      const topProducts = mockSalesData
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, 5);

      // Category breakdown
      const categoryBreakdown = mockSalesData.reduce((acc, item) => {
        const categoryName = item.product_categories?.name || 'ללא קטגוריה';
        if (!acc[categoryName]) {
          acc[categoryName] = { revenue: 0, quantity: 0 };
        }
        acc[categoryName].revenue += item.revenue;
        acc[categoryName].quantity += item.unitsSold;
        return acc;
      }, {} as Record<string, { revenue: number; quantity: number }>);

      // Monthly trend data (mock)
      const monthlyTrend = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(now.getFullYear(), i, 1).toLocaleDateString('he-IL', { month: 'short' }),
        revenue: Math.floor(Math.random() * 50000) + 10000,
        profit: Math.floor(Math.random() * 20000) + 5000,
      }));

      return {
        totalRevenue,
        totalCost,
        totalProfit,
        roi,
        topProducts,
        categoryBreakdown,
        monthlyTrend,
        products: mockSalesData,
      };
    },
    enabled: !!user?.id && !!business?.id,
  });

  return {
    reportsData,
    isLoading,
  };
};
