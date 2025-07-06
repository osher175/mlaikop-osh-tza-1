
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import type { Database } from '@/integrations/supabase/types';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

export const useSuppliers = () => {
  const { businessContext } = useBusinessAccess();

  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['suppliers', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];
      
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, contact_email, phone, created_at')
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

  return {
    suppliers,
    isLoading,
    error,
  };
};
