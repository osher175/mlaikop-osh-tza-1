import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';

const REPORT_QUERY_KEYS = [
  'reports_aggregate',
  'reports_aggregate_previous',
  'insights',
] as const;

/**
 * Subscribes to realtime changes on inventory_actions and products,
 * then invalidates AND refetches all reports-related queries with debounce.
 * Also forces refetch on tab visibility change.
 */
export const useRealtimeReports = () => {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const businessId = business?.id;
    if (!businessId) return;

    const forceRefreshAll = (source: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (import.meta.env.DEV) {
          console.log(`[RealtimeReports] 🔄 ${source} — invalidating + refetching:`, REPORT_QUERY_KEYS);
        }

        REPORT_QUERY_KEYS.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
          queryClient.refetchQueries({ queryKey: [key], type: 'active' });
        });
      }, 400);
    };

    // Realtime subscription
    const channel = supabase
      .channel(`reports-live-${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_actions', filter: `business_id=eq.${businessId}` },
        (payload) => {
          if (import.meta.env.DEV) {
            console.log('[RealtimeReports] ⚡ inventory_actions event:', payload.eventType);
          }
          forceRefreshAll('realtime:inventory_actions');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${businessId}` },
        (payload) => {
          if (import.meta.env.DEV) {
            console.log('[RealtimeReports] ⚡ products event:', payload.eventType);
          }
          forceRefreshAll('realtime:products');
        }
      )
      .subscribe();

    // Tab visibility — force refetch when user returns
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (import.meta.env.DEV) {
          console.log('[RealtimeReports] 👁️ Tab visible — forcing refetch');
        }
        REPORT_QUERY_KEYS.forEach((key) => {
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
  }, [business?.id, queryClient]);
};
