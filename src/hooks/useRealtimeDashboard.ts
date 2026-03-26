import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

const DASHBOARD_QUERY_KEYS = [
  'bi-analytics-real',
  'summary-stats',
  'insights',
  'notifications',
  'recent-activity',
  'reports_aggregate',
  'sales_by_dimension',
  'supplier-rankings',
] as const;

/**
 * Central realtime hook that listens to inventory_actions and products changes.
 * When a change is detected, it invalidates AND refetches all dashboard-related queries.
 */
export const useRealtimeDashboard = () => {
  const queryClient = useQueryClient();
  const { businessContext } = useBusinessAccess();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const businessId = businessContext?.business_id;
    if (!businessId) return;

    const forceRefreshAll = (source: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (import.meta.env.DEV) {
          console.log(`[RealtimeDashboard] 🔄 ${source} — invalidating + refetching:`, DASHBOARD_QUERY_KEYS);
        }

        DASHBOARD_QUERY_KEYS.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
          queryClient.refetchQueries({ queryKey: [key], type: 'active' });
        });
      }, 400);
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
        (payload) => {
          if (import.meta.env.DEV) {
            console.log('[RealtimeDashboard] ⚡ inventory_actions event:', payload.eventType);
          }
          forceRefreshAll('realtime:inventory_actions');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          if (import.meta.env.DEV) {
            console.log('[RealtimeDashboard] ⚡ products event:', payload.eventType);
          }
          forceRefreshAll('realtime:products');
        }
      )
      .subscribe();

    // Tab visibility — force refetch when user returns
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (import.meta.env.DEV) {
          console.log('[RealtimeDashboard] 👁️ Tab visible — forcing refetch');
        }
        DASHBOARD_QUERY_KEYS.forEach((key) => {
          queryClient.refetchQueries({ queryKey: [key], type: 'active' });
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [businessContext?.business_id, queryClient]);
};
