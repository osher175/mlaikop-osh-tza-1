import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

/**
 * Realtime feed for the "Recent activity" widget.
 *
 * Phase A3: the previous implementation also opened a second subscription on
 * `products` and invalidated the very same query key. Every product change
 * therefore triggered two refetches of `recent-activity` — once here and once
 * from `useRealtimeDashboard`, which already invalidates `recent-activity` on
 * both `products` and `inventory_actions` events. That duplicate channel is
 * removed; the observable refresh behavior is unchanged.
 */
export const useRealtimeActivity = () => {
  const queryClient = useQueryClient();
  const { businessContext } = useBusinessAccess();

  useEffect(() => {
    const businessId = businessContext?.business_id;
    if (!businessId) return;

    const channel = supabase
      .channel(`recent-activity-changes-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recent_activity',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          if (import.meta.env.DEV) {
            console.log('Real-time recent activity update:', payload.eventType);
          }
          queryClient.invalidateQueries({ queryKey: ['recent-activity', businessId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessContext?.business_id, queryClient]);
};
