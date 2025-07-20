
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Define local types
export interface ProductCategory {
  id: string;
  name: string;
  business_category_id: string;
  created_at: string;
  updated_at: string;
}

interface CreateProductCategoryData {
  name: string;
  business_category_id: string;
}

export const useProductCategories = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: productCategories = [], isLoading, error } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching product categories:', error);
        throw error;
      }
      
      return data as ProductCategory[];
    },
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
    createProductCategory: createProductCategoryMutation,
    isCreating: createProductCategoryMutation.isPending,
  };
};
