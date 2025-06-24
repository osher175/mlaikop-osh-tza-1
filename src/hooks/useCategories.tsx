
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/hooks/useBusiness';
import type { Database } from '@/integrations/supabase/types';

type ProductCategory = Database['public']['Tables']['product_categories']['Row'];

export const useCategories = () => {
  const { business } = useBusiness();

  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ['product-categories', business?.business_category_id],
    queryFn: async () => {
      if (!business?.business_category_id) return [];
      
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('business_category_id', business.business_category_id)
        .order('name');
      
      if (error) {
        console.error('Error fetching product categories:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!business?.business_category_id,
  });

  return {
    categories,
    isLoading,
    error,
  };
};
