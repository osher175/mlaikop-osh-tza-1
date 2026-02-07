import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SupplierQuote {
  id: string;
  procurement_request_id: string;
  supplier_id: string;
  price_per_unit: number;
  available: boolean;
  delivery_time_days: number | null;
  currency: string;
  raw_message: string | null;
  quote_source: string;
  score: number | null;
  created_at: string;
  suppliers?: { name: string; phone: string | null } | null;
}

export const useSupplierQuotes = (requestId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['supplier-quotes', requestId],
    queryFn: async () => {
      if (!requestId) return [];
      const { data, error } = await supabase
        .from('supplier_quotes')
        .select('*, suppliers(name, phone)')
        .eq('procurement_request_id', requestId)
        .order('score', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as SupplierQuote[];
    },
    enabled: !!requestId,
  });

  const addManualQuote = useMutation({
    mutationFn: async (quote: {
      procurement_request_id: string;
      supplier_id: string;
      price_per_unit: number;
      available: boolean;
      delivery_time_days?: number;
      raw_message?: string;
    }) => {
      const { data, error } = await supabase
        .from('supplier_quotes')
        .insert({ ...quote, quote_source: 'manual' })
        .select()
        .single();
      if (error) throw error;

      // Run scoring
      await supabase.rpc('score_procurement_quotes', { p_request_id: quote.procurement_request_id });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      toast({ title: 'הצעת מחיר נוספה בהצלחה' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה בהוספת הצעת מחיר', description: error.message, variant: 'destructive' });
    },
  });

  return { quotes, isLoading, addManualQuote };
};

// Placeholder for future AI analysis
export function analyze_quotes_with_ai(_quotes: SupplierQuote[]): null {
  // Future: call AI endpoint to improve ranking explanation
  return null;
}
