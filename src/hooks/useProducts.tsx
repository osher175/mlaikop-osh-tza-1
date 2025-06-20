
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export const useProducts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, error, refetch } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories:category_id(name),
          suppliers:supplier_id(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  const createProduct = useMutation({
    mutationFn: async (productData: ProductInsert) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...productData,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "מוצר נוסף בהצלחה",
        description: "המוצר נוסף למערכת",
      });
    },
    onError: (error) => {
      toast({
        title: "שגיאה",
        description: "שגיאה בהוספת המוצר",
        variant: "destructive",
      });
      console.error('Error creating product:', error);
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...updates }: ProductUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "מוצר עודכן",
        description: "המוצר עודכן בהצלחה",
      });
    },
    onError: (error) => {
      toast({
        title: "שגיאה",
        description: "שגיאה בעדכון המוצר",
        variant: "destructive",
      });
      console.error('Error updating product:', error);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "מוצר נמחק",
        description: "המוצר נמחק מהמערכת",
      });
    },
    onError: (error) => {
      toast({
        title: "שגיאה",
        description: "שגיאה במחיקת המוצר",
        variant: "destructive",
      });
      console.error('Error deleting product:', error);
    },
  });

  return {
    products,
    isLoading,
    error,
    refetch,
    createProduct,
    updateProduct,
    deleteProduct,
  };
};
