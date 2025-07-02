
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/hooks/useBusiness';

export const useSummaryStats = () => {
  const { user } = useAuth();
  const { business } = useBusiness();

  const { data, isLoading } = useQuery({
    queryKey: ['summary-stats', user?.id, business?.id],
    queryFn: async () => {
      if (!user?.id || !business?.id) return null;

      // Get all products count (including those with quantity 0 or negative)
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id);

      // Get products currently in stock (quantity > 0)
      const { count: inStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .gt('quantity', 0);

      // Get out of stock products (quantity <= 0)
      const { count: outOfStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .lte('quantity', 0);

      // Get notification settings for thresholds
      const { data: notificationSettings } = await supabase
        .from('notification_settings')
        .select('low_stock_threshold')
        .eq('business_id', business.id)
        .single();

      const threshold = notificationSettings?.low_stock_threshold || 5;

      // Get low stock products count (quantity > 0 but <= threshold)
      const { count: lowStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .gt('quantity', 0)
        .lte('quantity', threshold);

      // Get latest monthly profit (placeholder calculation)
      const { data: salesData } = await supabase
        .from('sales_cycles')
        .select('profit')
        .eq('business_id', business.id)
        .order('period_end', { ascending: false })
        .limit(1)
        .single();

      return {
        totalProducts: totalProducts || 0,
        inStockCount: inStockCount || 0,
        lowStockCount: lowStockCount || 0,
        outOfStockCount: outOfStockCount || 0,
        monthlyProfit: salesData?.profit || 0,
      };
    },
    enabled: !!user?.id && !!business?.id,
  });

  return {
    totalProducts: data?.totalProducts || 0,
    inStockCount: data?.inStockCount || 0,
    lowStockCount: data?.lowStockCount || 0,
    outOfStockCount: data?.outOfStockCount || 0,
    monthlyProfit: data?.monthlyProfit || 0,
    isLoading,
  };
};
