
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Data local types
interface ProductCategory {
  id: string;
  name: string;
  business_category_id: string;
  created_at?: string;
  updated_at?: string;
}

interface CreateProductCategoryData {
  name: string;
  business_category_id: string;
}

export const useProductCategories = (businessCategoryId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: productCategories = [], isLoading, error } = useQuery({
    queryKey: ['product-categories', businessCategoryId],
    queryFn: async () => {
      if (!businessCategoryId) return [];
      
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('business_category_id', businessCategoryId)
        .order('name');
      
      if (error) {
        console.error('Error fetching product categories:', error);
        throw error;
      }
      
      return data as ProductCategory[];
    },
    enabled: !!businessCategoryId,
  });

  const createProductCategoryMutation = useMutation({
    mutationFn: async (categoryData: CreateProductCategoryData) => {
      const { data, error } = await supabase
        .from('product_categories')
        .insert([categoryData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast({
        title: 'קטגוריה נוצרה בהצלחה',
        description: 'הקטגוריה נוספה למערכת',
      });
    },
    onError: (error) => {
      console.error('Error creating product category:', error);
      toast({
        title: 'שגיאה ביצירת הקטגוריה',
        description: 'אירעה שגיאה ביצירת הקטגוריה. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  return {
    productCategories,
    isLoading,
    error,
    createProductCategory: createProductCategoryMutation.mutate,
    isCreating: createProductCategoryMutation.isPending,
  };
};
