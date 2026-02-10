import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useProcurementActions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
  };

  const updateStatus = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: string }) => {
      const { error } = await supabase
        .from('procurement_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'סטטוס עודכן בהצלחה' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה בעדכון סטטוס', description: error.message, variant: 'destructive' });
    },
  });

  const updateNotes = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const { error } = await supabase
        .from('procurement_requests')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'הערות עודכנו' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה בעדכון הערות', description: error.message, variant: 'destructive' });
    },
  });

  const updateRecommendedQuote = useMutation({
    mutationFn: async ({ requestId, quoteId }: { requestId: string; quoteId: string }) => {
      const { error } = await supabase
        .from('procurement_requests')
        .update({ recommended_quote_id: quoteId, status: 'recommended', updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'הצעת מחיר מומלצת עודכנה' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה בעדכון המלצה', description: error.message, variant: 'destructive' });
    },
  });

  return { updateStatus, updateNotes, updateRecommendedQuote };
};
