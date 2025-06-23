
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

export interface RecentActivityItem {
  id: string;
  action_type: string;
  quantity_changed: number | null;
  timestamp: string;
  notes: string | null;
  product_name: string | null;
  product_id: string | null;
  user_id: string;
  business_id: string;
}

export const useRecentActivity = () => {
  const { businessContext } = useBusinessAccess();

  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['recent-activity', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];

      const { data, error } = await supabase
        .from('inventory_actions')
        .select(`
          id,
          action_type,
          quantity_changed,
          timestamp,
          notes,
          user_id,
          business_id,
          products!inner(
            id,
            name
          )
        `)
        .eq('business_id', businessContext.business_id)
        .order('timestamp', { ascending: false })
        .limit(15);

      if (error) {
        console.error('Error fetching recent activity:', error);
        throw error;
      }

      // Transform the data to match our interface
      return data.map(item => ({
        id: item.id,
        action_type: item.action_type,
        quantity_changed: item.quantity_changed,
        timestamp: item.timestamp,
        notes: item.notes,
        product_name: item.products?.name || null,
        product_id: item.products?.id || null,
        user_id: item.user_id,
        business_id: item.business_id
      })) as RecentActivityItem[];
    },
    enabled: !!businessContext?.business_id,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time feel
  });

  return {
    activities,
    isLoading,
    error
  };
};
