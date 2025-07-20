
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Define local types
interface Category {
  id: string;
  name: string;
  description?: string;
  business_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface CreateCategoryData {
  name: string;
  description?: string;
  business_id?: string;
}

export const useCategories = (businessId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ['categories', businessId],
    queryFn: async () => {
      const query = supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (businessId) {
        query.eq('business_id', businessId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching categories:', error);
        throw error;
      }
      
      return data as Category[];
    },
    enabled: true,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: CreateCategoryData) => {
      const { data, error } = await supabase
        .from('categories')
        .insert([categoryData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({
        title: 'קטגוריה נוצרה בהצלחה',
        description: 'הקטגוריה נוספה למערכת',
      });
    },
    onError: (error) => {
      console.error('Error creating category:', error);
      toast({
        title: 'שגיאה ביצירת הקטגוריה',
        description: 'אירעה שגיאה ביצירת הקטגוריה. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  return {
    categories,
    isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    isCreating: createCategoryMutation.isPending,
  };
};
