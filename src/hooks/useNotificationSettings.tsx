
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/hooks/useBusiness';
import { useToast } from '@/hooks/use-toast';

// Define local types
export interface NotificationSettings {
  id: string;
  business_id: string;
  notification_type: string;
  low_stock_enabled: boolean;
  expiration_enabled: boolean;
  plan_limit_enabled: boolean;
  whatsapp_to_supplier: boolean;
  low_stock_threshold: number;
  expiration_days_warning: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UpdateNotificationSettingsData {
  low_stock_enabled?: boolean;
  expiration_enabled?: boolean;
  plan_limit_enabled?: boolean;
  whatsapp_to_supplier?: boolean;
  low_stock_threshold?: number;
  expiration_days_warning?: number;
}

export const useNotificationSettings = () => {
  const { business } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['notification-settings', business?.id],
    queryFn: async () => {
      if (!business?.id) return null;
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('business_id', business.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching notification settings:', error);
        throw error;
      }
      
      return data as NotificationSettings | null;
    },
    enabled: !!business?.id,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settingsData: UpdateNotificationSettingsData) => {
      if (!business?.id) throw new Error('No business ID');

      const { data, error } = await supabase
        .from('notification_settings')
        .upsert({
          business_id: business.id,
          ...settingsData,
          updated_at: new Date().toISOString(),
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
        description: 'השינויים נשמרו בהצלחה',
      });
    },
    onError: (error) => {
      console.error('Error updating notification settings:', error);
      toast({
        title: 'שגיאה בעדכון הגדרות',
        description: 'אירעה שגיאה בשמירת השינויים',
        variant: 'destructive',
      });
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettingsMutation,
    createOrUpdateSettings: updateSettingsMutation,
    isUpdating: updateSettingsMutation.isPending,
  };
};
