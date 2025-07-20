
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Define local types
export interface BusinessCategory {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export const useBusinessCategories = () => {
  const { data: businessCategories = [], isLoading, error } = useQuery({
    queryKey: ['business-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_categories')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching business categories:', error);
        throw error;
      }
      
      return data as BusinessCategory[];
    },
  });

  return {
    businessCategories,
    isLoading,
    error,
  };
};
