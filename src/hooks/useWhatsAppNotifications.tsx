
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppNotification {
  id: string;
  business_id: string;
  product_id: string;
  supplier_id: string;
  message_text: string;
  was_sent: boolean;
  sent_at: string;
  sales_agent_phone: string;
  recipient_phone: string;
  trigger_type: string;
  created_at: string;
}

interface CreateWhatsAppNotificationParams {
  product_id: string;
  supplier_id: string;
  product_name: string;
  sales_agent_name?: string;
  sales_agent_phone: string;
  recipient_phone: string;
}

export const useWhatsAppNotifications = () => {
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['whatsapp-notifications', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];

      const { data, error } = await supabase
        .from('whatsapp_notifications_log')
        .select('*')
        .eq('business_id', businessContext.business_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching WhatsApp notifications:', error);
        throw error;
      }

      return data as WhatsAppNotification[];
    },
    enabled: !!businessContext?.business_id,
  });

  const createWhatsAppNotification = useMutation({
    mutationFn: async (params: CreateWhatsAppNotificationParams) => {
      if (!businessContext?.business_id) {
        throw new Error('Business context not found');
      }

      // Check if notification already exists for this product in the last 24 hours
      const { data: existingNotification } = await supabase
        .from('whatsapp_notifications_log')
        .select('id')
        .eq('product_id', params.product_id)
        .eq('business_id', businessContext.business_id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (existingNotification) {
        console.log('WhatsApp notification already exists for this product in the last 24 hours');
        return;
      }

      // Create message text
      const agentName = params.sales_agent_name || 'הספק';
      const messageText = `היי ${agentName}, אשמח להצעת מחיר עבור ${params.product_name}`;

      const { data, error } = await supabase
        .from('whatsapp_notifications_log')
        .insert({
          business_id: businessContext.business_id,
          product_id: params.product_id,
          supplier_id: params.supplier_id,
          message_text: messageText,
          sales_agent_phone: params.sales_agent_phone,
          recipient_phone: params.recipient_phone,
          trigger_type: 'stock_zero',
          was_sent: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating WhatsApp notification:', error);
        throw error;
      }

      console.log('WhatsApp notification created:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-notifications'] });
    },
    onError: (error: any) => {
      console.error('Error creating WhatsApp notification:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן היה ליצור התראת WhatsApp",
        variant: "destructive",
      });
    },
  });

  const updateNotificationStatus = useMutation({
    mutationFn: async ({ id, was_sent }: { id: string; was_sent: boolean }) => {
      const { data, error } = await supabase
        .from('whatsapp_notifications_log')
        .update({ was_sent, sent_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating notification status:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-notifications'] });
    },
  });

  return {
    notifications,
    isLoading,
    createWhatsAppNotification,
    updateNotificationStatus,
  };
};
