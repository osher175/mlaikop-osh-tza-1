
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

export const useRealtimeActivity = () => {
  const queryClient = useQueryClient();
  const { businessContext } = useBusinessAccess();

  useEffect(() => {
    if (!businessContext?.business_id) return;

    // Subscribe to recent_activity table changes
    const channel = supabase
      .channel('recent-activity-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'recent_activity',
          filter: `business_id=eq.${businessContext.business_id}`
        },
        (payload) => {
          console.log('Real-time recent activity update:', payload);
          // Invalidate and refetch the recent activity query
          queryClient.invalidateQueries({ 
            queryKey: ['recent-activity', businessContext.business_id] 
          });
        }
      )
      .subscribe();

    // Also subscribe to products table changes to update activity when products change
    const productsChannel = supabase
      .channel('products-activity-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `business_id=eq.${businessContext.business_id}`
        },
        (payload) => {
          console.log('Real-time product update affecting activity:', payload);
          // Invalidate and refetch the recent activity query when products change
          queryClient.invalidateQueries({ 
            queryKey: ['recent-activity', businessContext.business_id] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(productsChannel);
    };
  }, [businessContext?.business_id, queryClient]);
};
