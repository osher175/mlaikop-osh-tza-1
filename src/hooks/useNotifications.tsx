
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusiness } from './useBusiness';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Notification = Database['public']['Tables']['notifications']['Row'] & {
  products?: { name: string } | null;
};

export const useNotifications = () => {
  const { user } = useAuth();
  const { business } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id, business?.id],
    queryFn: async () => {
      if (!user?.id || !business?.id) return [];
      
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          products:product_id(name)
        `)
        .eq('business_id', business.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error fetching notifications:', error);
        throw error;
      }
      
      return data as Notification[];
    },
    enabled: !!user?.id && !!business?.id,
  });

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      toast({
        title: "שגיאה",
        description: "שגיאה בעדכון ההתראה",
        variant: "destructive",
      });
      console.error('Error marking notification as read:', error);
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!business?.id || !user?.id) throw new Error('No business or user found');
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('business_id', business.id)
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "הצלחה",
        description: "כל ההתראות סומנו כנקראו",
      });
    },
    onError: (error) => {
      toast({
        title: "שגיאה",
        description: "שגיאה בעדכון ההתראות",
        variant: "destructive",
      });
      console.error('Error marking all notifications as read:', error);
    },
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
};
