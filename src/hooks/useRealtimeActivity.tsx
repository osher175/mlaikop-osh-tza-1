
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

export const useRealtimeActivity = () => {
  const queryClient = useQueryClient();
  const { businessContext } = useBusinessAccess();

  useEffect(() => {
    if (!businessContext?.business_id) return;

    // Subscribe to inventory_actions table changes
    const channel = supabase
      .channel('inventory-activity-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'inventory_actions',
          filter: `business_id=eq.${businessContext.business_id}`
        },
        (payload) => {
          console.log('Real-time inventory activity update:', payload);
          // Invalidate and refetch the recent activity query
          queryClient.invalidateQueries({ 
            queryKey: ['recent-activity', businessContext.business_id] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessContext?.business_id, queryClient]);
};
