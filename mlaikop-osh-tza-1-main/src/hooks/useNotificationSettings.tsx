import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusiness } from './useBusiness';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type NotificationSettings = Database['public']['Tables']['notification_settings']['Row'];
type NotificationSettingsInsert = Database['public']['Tables']['notification_settings']['Insert'];

export const useNotificationSettings = () => {
  const { user } = useAuth();
  const { business } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notification-settings', user?.id, business?.id],
    queryFn: async () => {
      if (!user?.id || !business?.id) {
        console.log('Missing user or business for notification settings');
        return null;
      }
      
      console.log('Fetching notification settings for business:', business.id);
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('business_id', business.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching notification settings:', error);
        throw error;
      }
      
      console.log('Fetched notification settings:', data);
      return data;
    },
    enabled: !!user?.id && !!business?.id,
  });

  const createOrUpdateSettings = useMutation({
    mutationFn: async (settingsData: Omit<NotificationSettingsInsert, 'business_id'>) => {
      if (!business?.id) {
        console.error('No business found for notification settings');
        throw new Error('No business found');
      }
      
      console.log('Saving notification settings:', settingsData, 'for business:', business.id);
      
      // Try to update first
      const { data: existingData } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('business_id', business.id)
        .maybeSingle();

      console.log('Existing settings:', existingData);

      if (existingData) {
        // Update existing settings
        console.log('Updating existing notification settings');
        const { data, error } = await supabase
          .from('notification_settings')
          .update({
            ...settingsData,
            updated_at: new Date().toISOString(),
          })
          .eq('business_id', business.id)
          .select()
          .single();
        
        if (error) {
          console.error('Error updating notification settings:', error);
          throw error;
        }
        
        console.log('Updated notification settings:', data);
        return data;
      } else {
        // Create new settings
        console.log('Creating new notification settings');
        const { data, error } = await supabase
          .from('notification_settings')
          .insert({
            ...settingsData,
            business_id: business.id,
          })
          .select()
          .single();
        
        if (error) {
          console.error('Error creating notification settings:', error);
          throw error;
        }
        
        console.log('Created notification settings:', data);
        return data;
      }
    },
    onSuccess: (data, settingsData) => {
      if (data && data.low_stock_threshold === settingsData.low_stock_threshold) {
        toast({
          title: "הגדרות נשמרו בהצלחה",
          description: "הגדרות ההתראות עודכנו בהצלחה",
        });
      } else {
        toast({
          title: "שגיאה",
          description: "הערך לא נשמר בפועל. בדוק הרשאות או שגיאות.",
          variant: "destructive",
        });
        console.error('Mismatch after save:', { saved: data?.low_stock_threshold, expected: settingsData.low_stock_threshold });
      }
    },
    onError: (error) => {
      console.error('Error saving notification settings:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה בשמירת ההגדרות: " + error.message,
        variant: "destructive",
      });
    },
  });

  return {
    settings,
    isLoading,
    createOrUpdateSettings,
  };
};
