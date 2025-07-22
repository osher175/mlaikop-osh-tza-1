
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Supplier = Database['public']['Tables']['suppliers']['Row'];
type CreateSupplierParams = Database['public']['Tables']['suppliers']['Insert'];

export const useSuppliers = () => {
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['suppliers', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];
      
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', businessContext.business_id)
        .order('name');
      
      if (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }
      
      return data;
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
