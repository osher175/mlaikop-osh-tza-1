
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusiness } from './useBusiness';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type NotificationSettings = Database['public']['Tables']['notification_settings']['Row'];
type NotificationSettingsInsert = Database['public']['Tables']['notification_settings']['Insert'];
type NotificationSettingsUpdate = Database['public']['Tables']['notification_settings']['Update'];

export const useNotificationSettings = () => {
  const { user } = useAuth();
  const { business } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notification-settings', user?.id, business?.id],
    queryFn: async () => {
      if (!user?.id || !business?.id) return null;
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('business_id', business.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching notification settings:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id && !!business?.id,
  });

  const createOrUpdateSettings = useMutation({
    mutationFn: async (settingsData: Omit<NotificationSettingsInsert, 'business_id'>) => {
      if (!business?.id) throw new Error('No business found');
      
      // Try to update first
      const { data: existingData } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('business_id', business.id)
        .maybeSingle();

      if (existingData) {
        // Update existing settings
        const { data, error } = await supabase
          .from('notification_settings')
          .update({
            ...settingsData,
            updated_at: new Date().toISOString(),
          })
          .eq('business_id', business.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Create new settings
        const { data, error } = await supabase
          .from('notification_settings')
          .insert({
            ...settingsData,
            business_id: business.id,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast({
        title: "הגדרות נשמרו",
        description: "הגדרות ההתראות עודכנו בהצלחה",
      });
    },
    onError: (error) => {
      toast({
        title: "שגיאה",
        description: "שגיאה בשמירת ההגדרות",
        variant: "destructive",
      });
      console.error('Error saving notification settings:', error);
    },
  });

  return {
    settings,
    isLoading,
    createOrUpdateSettings,
  };
};
