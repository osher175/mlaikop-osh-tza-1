
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

      // Get total products count
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id);

      // Get notification settings for thresholds
      const { data: notificationSettings } = await supabase
        .from('notification_settings')
        .select('low_stock_threshold')
        .eq('business_id', business.id)
        .single();

      const threshold = notificationSettings?.low_stock_threshold || 5;

      // Get low stock products count
      const { count: lowStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .lte('quantity', threshold);

      // Get expired products count
      const { count: expiredCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .not('expiration_date', 'is', null)
        .lt('expiration_date', new Date().toISOString().split('T')[0]);

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
        lowStockCount: lowStockCount || 0,
        expiredCount: expiredCount || 0,
        monthlyProfit: salesData?.profit || 0,
      };
    },
    enabled: !!user?.id && !!business?.id,
  });

  return {
    totalProducts: data?.totalProducts || 0,
    lowStockCount: data?.lowStockCount || 0,
    expiredCount: data?.expiredCount || 0,
    monthlyProfit: data?.monthlyProfit || 0,
    isLoading,
  };
};
