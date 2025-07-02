
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

export interface RecentActivityItem {
  id: string;
  action_type: string;
  title: string;
  quantity_changed: number | null;
  timestamp: string;
  priority_level: string;
  status_color: string;
  is_system_generated: boolean;
  is_critical: boolean;
  product_id: string | null;
  product_name: string | null;
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
        .from('recent_activity')
        .select(`
          id,
          action_type,
          title,
          quantity_changed,
          timestamp,
          priority_level,
          status_color,
          is_system_generated,
          is_critical,
          product_id,
          user_id,
          business_id,
          products(
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
        title: item.title,
        quantity_changed: item.quantity_changed,
        timestamp: item.timestamp,
        priority_level: item.priority_level,
        status_color: item.status_color,
        is_system_generated: item.is_system_generated,
        is_critical: item.is_critical,
        product_id: item.product_id,
        product_name: item.products?.name || null,
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
