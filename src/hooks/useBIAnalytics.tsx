
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Define local types
interface AnalyticsData {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  expiringItems: number;
  topProducts: Array<{
    name: string;
    quantity: number;
    value: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    revenue: number;
    costs: number;
  }>;
}

export const useBIAnalytics = (businessId?: string) => {
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['bi-analytics', businessId],
    queryFn: async (): Promise<AnalyticsData> => {
      if (!businessId) {
        return {
          totalProducts: 0,
          totalValue: 0,
          lowStockItems: 0,
          expiringItems: 0,
          topProducts: [],
          monthlyTrends: [],
        };
      }

      // Get products data
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId);

      if (productsError) {
        console.error('Error fetching products for analytics:', productsError);
        throw productsError;
      }

      // Calculate analytics
      const totalProducts = products?.length || 0;
      const totalValue = products?.reduce((sum, product) => 
        sum + (product.quantity * (product.price || 0)), 0) || 0;
      
      const lowStockItems = products?.filter(product => product.quantity < 5).length || 0;
      
      const expiringItems = products?.filter(product => {
        if (!product.expiration_date) return false;
        const expirationDate = new Date(product.expiration_date);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
      }).length || 0;

      const topProducts = products
        ?.sort((a, b) => (b.quantity * (b.price || 0)) - (a.quantity * (a.price || 0)))
        .slice(0, 5)
        .map(product => ({
          name: product.name,
          quantity: product.quantity,
          value: product.quantity * (product.price || 0),
        })) || [];

      return {
        totalProducts,
        totalValue,
        lowStockItems,
        expiringItems,
        topProducts,
        monthlyTrends: [], // Would need sales data to calculate this
      };
    },
    enabled: !!businessId,
  });

  return {
    analytics,
    isLoading,
    error,
  };
};
