import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useToast } from '@/hooks/use-toast';

export interface SupplierPair {
  id: string;
  business_id: string;
  scope: 'category' | 'product';
  category_id: string | null;
  product_id: string | null;
  supplier_a_id: string;
  supplier_b_id: string;
  strategy: 'cheapest' | 'quality' | 'balanced';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useSupplierPairs = (scopeFilter?: 'category' | 'product') => {
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const businessId = businessContext?.business_id;

  const { data: pairs = [], isLoading } = useQuery({
    queryKey: ['supplier-pairs', businessId, scopeFilter],
    queryFn: async () => {
      if (!businessId) return [];
      let query = supabase
        .from('procurement_supplier_pairs')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (scopeFilter) {
        query = query.eq('scope', scopeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as SupplierPair[];
    },
    enabled: !!businessId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['supplier-pairs'] });
  };

  const upsertPair = useMutation({
    mutationFn: async (pair: {
      scope: 'category' | 'product';
      category_id?: string | null;
      product_id?: string | null;
      supplier_a_id: string;
      supplier_b_id: string;
      strategy?: string;
      is_active?: boolean;
      id?: string;
    }) => {
      if (!businessId) throw new Error('Missing business context');

      // Prevent same supplier
      if (pair.supplier_a_id === pair.supplier_b_id) {
        throw new Error('ספק A וספק B לא יכולים להיות אותו ספק');
      }

      const row = {
        business_id: businessId,
        scope: pair.scope,
        category_id: pair.category_id || null,
        product_id: pair.product_id || null,
        supplier_a_id: pair.supplier_a_id,
        supplier_b_id: pair.supplier_b_id,
        strategy: pair.strategy || 'balanced',
        is_active: pair.is_active !== undefined ? pair.is_active : true,
        updated_at: new Date().toISOString(),
      };

      // If we have an explicit id, just update
      if (pair.id) {
        const { error } = await supabase
          .from('procurement_supplier_pairs')
          .update(row)
          .eq('id', pair.id);
        if (error) throw error;
        return;
      }

      // True upsert: look for existing active pair matching scope key
      let existingId: string | null = null;

      if (pair.scope === 'category' && pair.category_id) {
        const { data: existing } = await supabase
          .from('procurement_supplier_pairs')
          .select('id')
          .eq('business_id', businessId)
          .eq('scope', 'category')
          .eq('category_id', pair.category_id)
          .eq('is_active', true)
          .maybeSingle();
        existingId = existing?.id ?? null;
      } else if (pair.scope === 'product' && pair.product_id) {
        const { data: existing } = await supabase
          .from('procurement_supplier_pairs')
          .select('id')
          .eq('business_id', businessId)
          .eq('scope', 'product')
          .eq('product_id', pair.product_id)
          .eq('is_active', true)
          .maybeSingle();
        existingId = existing?.id ?? null;
      }

      if (existingId) {
        const { error } = await supabase
          .from('procurement_supplier_pairs')
          .update(row)
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('procurement_supplier_pairs')
          .insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'זוג ספקים נשמר בהצלחה' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה בשמירת זוג ספקים', description: error.message, variant: 'destructive' });
    },
  });

  const deletePair = useMutation({
    mutationFn: async (pairId: string) => {
      const { error } = await supabase
        .from('procurement_supplier_pairs')
        .delete()
        .eq('id', pairId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'זוג ספקים נמחק' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה במחיקת זוג ספקים', description: error.message, variant: 'destructive' });
    },
  });

  return { pairs, isLoading, upsertPair, deletePair };
};
