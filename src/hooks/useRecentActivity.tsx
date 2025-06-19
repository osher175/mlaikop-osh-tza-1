
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusiness } from './useBusiness';
import type { Database } from '@/integrations/supabase/types';

type RecentActivityRow = Database['public']['Tables']['recent_activity']['Row'];

// Make the joined types more flexible to handle potential query errors
type RecentActivity = RecentActivityRow & {
  products?: { name: string } | null;
  profiles?: { first_name: string; last_name: string } | null;
};

export const useRecentActivity = (limit: number = 10) => {
  const { user } = useAuth();
  const { business } = useBusiness();
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['recent_activity', business?.id, limit],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .from('recent_activity')
        .select(`
          *,
          products:product_id(name),
          profiles:user_id(first_name, last_name)
        `)
        .eq('business_id', business.id)
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching recent activities:', error);
        throw error;
      }
      
      // Transform the data to handle potential join failures more gracefully
      const transformedData = (data || []).map(activity => ({
        ...activity,
        products: activity.products && typeof activity.products === 'object' && 'name' in activity.products 
          ? activity.products 
          : null,
        profiles: activity.profiles && typeof activity.profiles === 'object' && 'first_name' in activity.profiles
          ? activity.profiles 
          : null,
      }));
      
      return transformedData as RecentActivity[];
    },
    enabled: !!business?.id && !!user?.id,
  });

  // Set up real-time subscription for live updates
  useEffect(() => {
    if (!business?.id) return;

    const channel = supabase
      .channel('recent_activity_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recent_activity',
          filter: `business_id=eq.${business.id}`,
        },
        (payload) => {
          console.log('Recent activity change detected:', payload);
          // Invalidate and refetch the query
          queryClient.invalidateQueries({ queryKey: ['recent_activity'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [business?.id, queryClient]);

  return {
    activities,
    isLoading,
    error,
  };
};
