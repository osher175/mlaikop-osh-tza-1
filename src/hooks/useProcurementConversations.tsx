import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProcurementConversation {
  id: string;
  business_id: string;
  procurement_request_id: string;
  product_id: string;
  supplier_id: string;
  status: string;
  mode: string;
  last_outgoing_at: string | null;
  last_incoming_at: string | null;
  created_at: string;
  suppliers?: { name: string; phone: string | null } | null;
}

export interface ProcurementMessage {
  id: string;
  conversation_id: string;
  direction: string;
  message_text: string;
  provider_message_id: string | null;
  status: string;
  created_at: string;
}

export const useProcurementConversations = (requestId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['procurement-conversations', requestId],
    queryFn: async () => {
      if (!requestId) return [];
      const { data, error } = await supabase
        .from('procurement_conversations')
        .select('*, suppliers(name, phone)')
        .eq('procurement_request_id', requestId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProcurementConversation[];
    },
    enabled: !!requestId,
  });

  const toggleMode = useMutation({
    mutationFn: async ({ conversationId, newMode }: { conversationId: string; newMode: string }) => {
      const { error } = await supabase
        .from('procurement_conversations')
        .update({ mode: newMode })
        .eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-conversations', requestId] });
      toast({ title: 'מצב שיחה עודכן' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה בעדכון מצב שיחה', description: error.message, variant: 'destructive' });
    },
  });

  return { conversations, conversationsLoading, toggleMode };
};

export const useProcurementMessages = (conversationId?: string) => {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['procurement-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('procurement_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ProcurementMessage[];
    },
    enabled: !!conversationId,
  });

  return { messages, isLoading };
};
