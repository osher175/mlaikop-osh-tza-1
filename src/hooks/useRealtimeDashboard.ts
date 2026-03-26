import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

/**
 * Central realtime hook that listens to inventory_actions and products changes.
 * When a change is detected, it invalidates all dashboard-related query caches
 * so every card, chart, and insight refreshes automatically.
 */
export const useRealtimeDashboard = () => {
  const queryClient = useQueryClient();
  const { businessContext } = useBusinessAccess();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const businessId = businessContext?.business_id;
    if (!businessId) return;

    const invalidateAll = () => {
      // Debounce to prevent invalidation storms during rapid sequential updates
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['bi-analytics-real'] });
        queryClient.invalidateQueries({ queryKey: ['summary-stats'] });
        queryClient.invalidateQueries({ queryKey: ['insights'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
      }, 500);
    };

    const channel = supabase
      .channel(`dashboard-live-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_actions',
          filter: `business_id=eq.${businessId}`,
        },
        invalidateAll
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `business_id=eq.${businessId}`,
        },
        invalidateAll
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [businessContext?.business_id, queryClient]);
};
