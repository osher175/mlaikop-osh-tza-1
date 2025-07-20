
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Define local types
interface NotificationSettings {
  id: string;
  business_id: string;
  low_stock_enabled: boolean;
  low_stock_threshold: number;
  expiration_enabled: boolean;
  expiration_days_warning: number;
  plan_limit_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

interface UpdateNotificationSettingsData {
  low_stock_enabled?: boolean;
  low_stock_threshold?: number;
  expiration_enabled?: boolean;
  expiration_days_warning?: number;
  plan_limit_enabled?: boolean;
}

export const useNotificationSettings = (businessId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['notification-settings', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('business_id', businessId)
        .single();
      
      if (error) {
        console.error('Error fetching notification settings:', error);
        return null;
      }
      
      return data as NotificationSettings;
    },
    enabled: !!businessId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settingsData: UpdateNotificationSettingsData) => {
      if (!businessId) throw new Error('Business ID is required');
      
      const { data, error } = await supabase
        .from('notification_settings')
        .upsert({
          business_id: businessId,
          ...settingsData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast({
        title: 'הגדרות התראות עודכנו',
        description: 'ההגדרות נשמרו בהצלחה',
      });
    },
    onError: (error) => {
      console.error('Error updating notification settings:', error);
      toast({
        title: 'שגיאה בעדכון ההגדרות',
        description: 'אירעה שגיאה בשמירת ההגדרות. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettingsMutation.mutate,
    isUpdating: updateSettingsMutation.isPending,
  };
};
