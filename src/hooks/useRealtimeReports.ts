import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';

/**
 * Subscribes to realtime changes on inventory_actions and products,
 * then invalidates reports-related query keys with debounce.
 */
export const useRealtimeReports = () => {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const businessId = business?.id;
    if (!businessId) return;

    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['reports_aggregate'] });
        queryClient.invalidateQueries({ queryKey: ['top_products_ranking'] });
      }, 500);
    };

    const channel = supabase
      .channel(`reports-live-${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_actions', filter: `business_id=eq.${businessId}` },
        invalidate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${businessId}` },
        invalidate
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [business?.id, queryClient]);
};
