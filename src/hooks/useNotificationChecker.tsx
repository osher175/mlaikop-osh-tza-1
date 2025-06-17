
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusiness } from './useBusiness';

export const useNotificationChecker = () => {
  const { user } = useAuth();
  const { business } = useBusiness();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id || !business?.id) return;

    // Check for notifications every 5 minutes
    const checkNotifications = async () => {
      try {
        // Call the notification check functions
        await supabase.rpc('check_low_stock_notifications');
        await supabase.rpc('check_expiration_notifications');
        
        // Invalidate notifications query to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };

    // Check immediately
    checkNotifications();

    // Set up interval to check every 5 minutes
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id, business?.id, queryClient]);
};
