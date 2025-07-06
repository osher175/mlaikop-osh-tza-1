
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

export const useSuppliers = () => {
  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, contact_email, phone, address, created_at')
        .order('name');
      
      if (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }
      
      return data;
    },
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
