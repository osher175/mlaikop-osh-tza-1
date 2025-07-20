
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Define local types
export interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
  phone?: string;
  sales_agent_name?: string;
  sales_agent_phone?: string;
  agent_name?: string;
  business_id?: string;
  created_at?: string;
  updated_at?: string;
}

export const useSuppliers = () => {
  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }
      
      return data as Supplier[];
    },
  });

  return {
    suppliers,
    isLoading,
    error,
  };
};
