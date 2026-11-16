
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { classificationColumn, missingClassificationColumn, type SupplierListRole } from '@/lib/v2/supplierClassification';

type Supplier = Database['public']['Tables']['suppliers']['Row'];
type CreateSupplierParams = Database['public']['Tables']['suppliers']['Insert'];

export async function fetchBusinessSuppliers(businessId: string, role: SupplierListRole = 'all') {
  const base = () => supabase.from('suppliers').select('*').eq('business_id', businessId);
  if (role === 'all') {
    const { data, error } = await base().order('name');
    if (error) throw error;
    return data ?? [];
  }
  const column = classificationColumn(role);
  const filtered = await base().filter(column, 'eq', true).order('name');
  if (filtered.error && missingClassificationColumn(filtered.error) && role === 'local') {
    const fallback = await base().order('name');
    if (fallback.error) throw fallback.error;
    return fallback.data ?? [];
  }
  if (filtered.error) throw filtered.error;
  return filtered.data ?? [];
}

export const useSuppliers = (role: SupplierListRole = 'all') => {
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['suppliers', businessContext?.business_id, role],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];
      return fetchBusinessSuppliers(businessContext.business_id, role);
    },
    enabled: !!businessContext?.business_id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const createSupplier = useMutation({
    mutationFn: async (supplierData: CreateSupplierParams) => {
      if (!businessContext?.business_id) {
        throw new Error('Business context not found');
      }

      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          ...supplierData,
          business_id: businessContext.business_id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating supplier:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error: any) => {
      console.error('Error creating supplier:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן היה ליצור את הספק",
        variant: "destructive",
      });
    },
  });

  return {
    suppliers,
    isLoading,
    error,
    createSupplier,
  };
};
