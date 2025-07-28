
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';

interface StockApproval {
  id: string;
  product_id: string;
  product_name: string;
  business_id: string;
  is_approved: boolean;
  created_at: string;
  approved_at?: string;
}

export const useStockApprovals = () => {
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allApprovals = [], isLoading, refetch } = useQuery({
    queryKey: ['stock-approvals', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];

      const { data, error } = await supabase
        .from('stock_approvals')
        .select('*')
        .eq('business_id', businessContext.business_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching stock approvals:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!businessContext?.business_id,
  });

  const approveStockMutation = useMutation({
    mutationFn: async ({ productId, productName }: { productId: string; productName: string }) => {
      if (!businessContext?.business_id) {
        throw new Error('Business context not found');
      }

      // Check if approval already exists
      const existingApproval = allApprovals.find(approval => approval.product_id === productId);
      
      if (existingApproval) {
        // Update existing approval
        const { error } = await supabase
          .from('stock_approvals')
          .update({ 
            is_approved: true, 
            approved_at: new Date().toISOString() 
          })
          .eq('id', existingApproval.id);

        if (error) {
          console.error('Error updating stock approval:', error);
          throw error;
        }
      } else {
        // Create new approval record
        const { error } = await supabase
          .from('stock_approvals')
          .insert({
            product_id: productId,
            product_name: productName,
            business_id: businessContext.business_id,
            is_approved: true,
            approved_at: new Date().toISOString()
          });

        if (error) {
          console.error('Error creating stock approval:', error);
          throw error;
        }
      }

      // Send notification to N8N webhook
      try {
        const response = await fetch('https://production-n8n.onrender.com/webhook/approval-confirmed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: productId })
        });

        if (!response.ok) {
          console.error('N8N webhook failed:', response.status, response.statusText);
        }
      } catch (webhookError) {
        console.error('Error calling N8N webhook:', webhookError);
        // Don't fail the entire operation if webhook fails
      }

      return productId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-approvals'] });
      toast({
        title: "הודעה נשלחה בהצלחה",
        description: "הודעה נשלחה לספק בהצלחה",
      });
    },
    onError: (error: any) => {
      console.error('Error in approve stock mutation:', error);
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בשליחת הודעה לספק",
        variant: "destructive",
      });
    },
  });

  const canSendToSupplier = (productId: string) => {
    // Check if there's no approved record for this product
    const approvedRecord = allApprovals.find(approval => 
      approval.product_id === productId && approval.is_approved
    );
    return !approvedRecord;
  };

  const isPendingApproval = (productId: string) => {
    return allApprovals.some(approval => 
      approval.product_id === productId && !approval.is_approved
    );
  };

  return {
    allApprovals,
    isLoading,
    refetch,
    approveStock: approveStockMutation.mutate,
    isApproving: approveStockMutation.isPending,
    canSendToSupplier,
    isPendingApproval,
  };
};
