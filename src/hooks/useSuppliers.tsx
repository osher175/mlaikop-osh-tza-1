
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  email: string;
  business_id: string;
};

export const useSuppliers = () => {
  const { businessContext } = useBusinessAccess();

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
      
      return data as Supplier[];
    },
    enabled: !!businessContext?.business_id,
  });

  return {
    suppliers,
    isLoading,
    error
  };
};
