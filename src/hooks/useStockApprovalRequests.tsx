
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type StockApprovalRequest = {
  id: string;
  product_id: string;
  supplier_id: string | null;
  product_name: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
};

export const useStockApprovalRequests = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pendingRequests = [], isLoading, error, refetch } = useQuery({
    queryKey: ['stock-approval-requests', businessContext?.business_id],
    queryFn: async () => {
      if (!user?.id || !businessContext?.business_id) return [];
      
      const { data, error } = await supabase
        .from('stock_approval_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching stock approval requests:', error);
        throw error;
      }
      
      return data as StockApprovalRequest[];
    },
    enabled: !!user?.id && !!businessContext?.business_id,
  });

  const approveRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('stock_approval_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();
      
      if (error) {
        console.error('Error approving request:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-approval-requests'] });
      toast({
        title: "בקשה אושרה",
        description: "הודעה תישלח לסוכן",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה באישור הבקשה",
        variant: "destructive",
      });
    },
  });

  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('stock_approval_requests')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();
      
      if (error) {
        console.error('Error rejecting request:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-approval-requests'] });
      toast({
        title: "בקשה נדחתה",
        description: "הודעה לא תישלח לסוכן",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בדחיית הבקשה",
        variant: "destructive",
      });
    },
  });

  return {
    pendingRequests,
    isLoading,
    error,
    approveRequest,
    rejectRequest,
    refetch,
  };
};
