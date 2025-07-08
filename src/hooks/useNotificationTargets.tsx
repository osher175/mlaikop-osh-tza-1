
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useNotificationTargets = (notificationId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: targets, isLoading } = useQuery({
    queryKey: ['notification-targets', notificationId],
    queryFn: async () => {
      if (!notificationId) return [];
      
      const { data, error } = await supabase
        .from('notification_targets')
        .select('*')
        .eq('notification_setting_id', notificationId);
      
      if (error) {
        console.error('Error fetching notification targets:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!notificationId,
  });

  const updateTargets = useMutation({
    mutationFn: async ({ notificationId, userIds }: { notificationId: string; userIds: string[] }) => {
      // First, delete existing targets
      const { error: deleteError } = await supabase
        .from('notification_targets')
        .delete()
        .eq('notification_setting_id', notificationId);

      if (deleteError) {
        console.error('Error deleting existing targets:', deleteError);
        throw deleteError;
      }

      // Then, insert new targets
      if (userIds.length > 0) {
        const targetsToInsert = userIds.map(userId => ({
          notification_setting_id: notificationId,
          user_id: userId
        }));

        const { error: insertError } = await supabase
          .from('notification_targets')
          .insert(targetsToInsert);

        if (insertError) {
          console.error('Error inserting new targets:', insertError);
          throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-targets'] });
      toast({
        title: "משתמשים עודכנו",
        description: "רשימת המשתמשים עודכנה בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בעדכון משתמשים",
        variant: "destructive",
      });
    },
  });

  return {
    targets,
    isLoading,
    updateTargets,
  };
};
