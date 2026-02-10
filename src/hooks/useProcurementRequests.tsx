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
  product_threshold?: number | null;
}

export const useProcurementRequests = (statusFilter?: string, searchTerm?: string) => {
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

      if (statusFilter === 'active') {
        query = query.in('status', ['draft', 'in_progress']);
      } else if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch thresholds for all products
      const productIds = (data || []).map((r: any) => r.product_id).filter(Boolean);
      const { data: thresholds } = productIds.length > 0
        ? await supabase
            .from('product_thresholds')
            .select('product_id, low_stock_threshold')
            .in('product_id', productIds)
        : { data: [] };

      const thresholdMap = new Map<string, number>();
      (thresholds || []).forEach((t: any) => thresholdMap.set(t.product_id, t.low_stock_threshold));

      // For each request with a recommended_quote_id, fetch the quote details
      const enriched = await Promise.all((data || []).map(async (req: any) => {
        let recommended_quote = null;
        if (req.recommended_quote_id) {
          const { data: quote } = await supabase
            .from('supplier_quotes')
            .select('supplier_id, price_per_unit, suppliers(name)')
            .eq('id', req.recommended_quote_id)
            .single();
          recommended_quote = quote;
        }
        return {
          ...req,
          supplier_quotes: req.supplier_quotes ? [req.supplier_quotes].flat() : [],
          recommended_quote,
          product_threshold: thresholdMap.get(req.product_id) ?? null,
        };
      }));

      return enriched as unknown as ProcurementRequest[];
    },
    enabled: !!businessId,
  });

  // Client-side search filtering
  const filteredRequests = searchTerm
    ? requests.filter(r => r.products?.name?.includes(searchTerm))
    : requests;

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
          status: 'draft',
          created_by: user.id,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
      toast({ title: 'בקשת רכש נוצרה בהצלחה' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה ביצירת בקשת רכש', description: error.message, variant: 'destructive' });
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

  return {
    requests: filteredRequests,
    isLoading,
    createManualRequest,
    cancelRequest,
  };
};
