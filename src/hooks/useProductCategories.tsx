import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type ProductCategory = Database['public']['Tables']['product_categories']['Row'];
type ProductCategoryInsert = Database['public']['Tables']['product_categories']['Insert'];

export const useProductCategories = (businessCategoryId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: productCategories = [], isLoading, error } = useQuery({
    queryKey: ['product-categories', businessCategoryId],
    queryFn: async () => {
      if (!businessCategoryId) return [];
      
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, description, business_category_id, created_at')
        .eq('business_category_id', businessCategoryId)
        .order('name');
      
      if (error) {
        console.error('Error fetching product categories:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!businessCategoryId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const createProductCategory = useMutation({
    mutationFn: async (categoryData: Omit<ProductCategoryInsert, 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('product_categories')
        .insert(categoryData)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating product category:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast({
        title: "קטגוריה נוצרה בהצלחה",
        description: "הקטגוריה החדשה נוספה למערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה ביצירת הקטגוריה",
        variant: "destructive",
      });
      console.error('Error creating product category:', error);
    },
  });

  return {
    productCategories,
    isLoading,
    error,
    createProductCategory,
  };
};
