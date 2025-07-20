import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/hooks/useBusiness';
import type { Database } from '@/integrations/supabase/types';

type ProductCategory = Database['public']['Tables']['product_categories']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export const useCategories = () => {
  const { business } = useBusiness();

  const { data: productCategories = [], isLoading: isLoadingProductCategories } = useQuery({
    queryKey: ['product-categories', business?.business_category_id],
    queryFn: async () => {
      if (!business?.business_category_id) return [];
      
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, business_category_id, created_at, updated_at')
        .eq('business_category_id', business.business_category_id)
        .order('name');
      
      if (error) {
        console.error('Error fetching product categories:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!business?.business_category_id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fallback to old categories table when business_category_id is not set
  const { data: oldCategories = [], isLoading: isLoadingOldCategories } = useQuery({
    queryKey: ['old-categories', business?.id],
    queryFn: async () => {
      if (!business?.id || business?.business_category_id) return [];
      
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, business_id, created_at, updated_at')
        .eq('business_id', business.id)
        .order('name');
      
      if (error) {
        console.error('Error fetching old categories:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!business?.id && !business?.business_category_id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Transform old categories to match product categories interface
  const transformedOldCategories = oldCategories.map(cat => ({
    id: cat.id,
    name: cat.name,
    business_category_id: null,
    created_at: cat.created_at,
    updated_at: cat.updated_at,
  }));

  const categories = business?.business_category_id ? productCategories : transformedOldCategories;
  const isLoading = business?.business_category_id ? isLoadingProductCategories : isLoadingOldCategories;

  return {
    categories,
    isLoading,
    error: null,
  };
};
