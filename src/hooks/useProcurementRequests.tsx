import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface ProcurementRequest {
  id: string;
  business_id: string;
  product_id: string;
  requested_quantity: number;
  trigger_type: 'out_of_stock' | 'below_threshold' | 'manual';
  urgency: 'low' | 'normal' | 'high';
  status: string;
  created_by: string | null;
  recommended_quote_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  products?: { name: string; barcode: string | null; quantity: number } | null;
  supplier_quotes?: { id: string }[];
  recommended_quote?: { supplier_id: string; price_per_unit: number; suppliers?: { name: string } | null } | null;
}

export const useProcurementRequests = (statusFilter?: string) => {
  const { businessContext } = useBusinessAccess();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const businessId = businessContext?.business_id;

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['procurement-requests', businessId, statusFilter],
    queryFn: async () => {
      if (!businessId) return [];

      let query = supabase
        .from('procurement_requests')
        .select(`
          *,
          products(name, barcode, quantity),
          supplier_quotes(id)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // For each request with a recommended_quote_id, fetch the quote details
      const enriched = await Promise.all((data || []).map(async (req: any) => {
        if (req.recommended_quote_id) {
          const { data: quote } = await supabase
            .from('supplier_quotes')
            .select('supplier_id, price_per_unit, suppliers(name)')
            .eq('id', req.recommended_quote_id)
            .single();
          return { ...req, supplier_quotes: req.supplier_quotes ? [req.supplier_quotes].flat() : [], recommended_quote: quote };
        }
        return { ...req, supplier_quotes: req.supplier_quotes ? [req.supplier_quotes].flat() : [], recommended_quote: null };
      }));

      return enriched as unknown as ProcurementRequest[];
    },
    enabled: !!businessId,
  });

  const createManualRequest = useMutation({
    mutationFn: async ({ productId, quantity, notes }: { productId: string; quantity: number; notes?: string }) => {
      if (!businessId || !user?.id) throw new Error('Missing business or user context');

      const { data, error } = await supabase
        .from('procurement_requests')
        .insert({
          business_id: businessId,
          product_id: productId,
          requested_quantity: quantity,
          trigger_type: 'manual' as const,
          urgency: 'normal' as const,
          status: 'waiting_for_quotes',
          created_by: user.id,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      toast({ title: 'בקשת רכש נוצרה בהצלחה' });

      // Send quote requests to suppliers via edge function
      try {
        await supabase.functions.invoke('procurement-webhook', {
          body: { procurement_request_id: data.id },
          headers: { 'action': 'send_quote_requests' },
        });
      } catch (err) {
        console.error('Failed to send quote requests:', err);
      }
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה ביצירת בקשת רכש', description: error.message, variant: 'destructive' });
    },
  });

  const sendQuoteRequests = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('procurement-webhook', {
        body: { procurement_request_id: requestId },
        headers: { },
      });
      // Use query param approach instead
      const response = await fetch(
        `https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/procurement-webhook?action=send_quote_requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0YWtnY3RtdGF5YWxjYnBucnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMDQzMjUsImV4cCI6MjA2NTY4MDMyNX0.CEosZQphWf4FG4mtJZ7Hlmz_c4EYoivyQru1VvGuPdU',
          },
          body: JSON.stringify({ procurement_request_id: requestId }),
        }
      );
      if (!response.ok) throw new Error('Failed to send quote requests');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      toast({ title: 'בקשות הצעת מחיר נשלחו לספקים' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה בשליחת בקשות', description: error.message, variant: 'destructive' });
    },
  });

  const approveOrder = useMutation({
    mutationFn: async ({ requestId, quoteId }: { requestId: string; quoteId: string }) => {
      const response = await fetch(
        `https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/procurement-webhook?action=approve_order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0YWtnY3RtdGF5YWxjYnBucnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMDQzMjUsImV4cCI6MjA2NTY4MDMyNX0.CEosZQphWf4FG4mtJZ7Hlmz_c4EYoivyQru1VvGuPdU',
          },
          body: JSON.stringify({ procurement_request_id: requestId, quote_id: quoteId }),
        }
      );
      if (!response.ok) throw new Error('Failed to approve order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      toast({ title: 'ההזמנה אושרה בהצלחה' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה באישור ההזמנה', description: error.message, variant: 'destructive' });
    },
  });

  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('procurement_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      toast({ title: 'בקשת הרכש בוטלה' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה בביטול הבקשה', description: error.message, variant: 'destructive' });
    },
  });

  const updateRecommendedQuote = useMutation({
    mutationFn: async ({ requestId, quoteId }: { requestId: string; quoteId: string }) => {
      const { error } = await supabase
        .from('procurement_requests')
        .update({ recommended_quote_id: quoteId, updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      toast({ title: 'הצעת המחיר עודכנה' });
    },
  });

  return {
    requests,
    isLoading,
    createManualRequest,
    sendQuoteRequests,
    approveOrder,
    cancelRequest,
    updateRecommendedQuote,
  };
};
