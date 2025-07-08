
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { useToast } from '@/hooks/use-toast';

export const useNotificationManagement = () => {
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notification-management', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('business_id', businessContext.business_id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching notifications:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!businessContext?.business_id,
  });

  const createNotification = useMutation({
    mutationFn: async (notificationData: {
      notification_type: string;
      low_stock_threshold?: number;
      expiration_days_warning?: number;
      whatsapp_to_supplier: boolean;
      is_active: boolean;
    }) => {
      if (!businessContext?.business_id) {
        throw new Error('Business context not found');
      }

      const { data, error } = await supabase
        .from('notification_settings')
        .insert({
          ...notificationData,
          business_id: businessContext.business_id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating notification:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-management'] });
      toast({
        title: "התראה נוצרה",
        description: "ההתראה נוצרה בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה ביצירת התראה",
        variant: "destructive",
      });
    },
  });

  const updateNotification = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from('notification_settings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating notification:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-management'] });
      toast({
        title: "התראה עודכנה",
        description: "ההתראה עודכנה בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בעדכון התראה",
        variant: "destructive",
      });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notification_settings')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting notification:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-management'] });
      toast({
        title: "התראה נמחקה",
        description: "ההתראה נמחקה בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה במחיקת התראה",
        variant: "destructive",
      });
    },
  });

  return {
    notifications,
    isLoading,
    refetch,
    createNotification,
    updateNotification,
    deleteNotification,
  };
};
