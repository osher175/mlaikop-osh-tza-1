
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusinessAccess } from './useBusinessAccess';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export const useProducts = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, error, refetch } = useQuery({
    queryKey: ['products', businessContext?.business_id],
    queryFn: async () => {
      if (!user?.id || !businessContext?.business_id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessContext.business_id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!user?.id && !!businessContext?.business_id,
  });

  const createProduct = useMutation({
    mutationFn: async (productData: Omit<ProductInsert, 'business_id' | 'created_by'>) => {
      if (!user?.id || !businessContext?.business_id) {
        throw new Error('User or business not found');
      }
      
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...productData,
          business_id: businessContext.business_id,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating product:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "מוצר נוצר בהצלחה",
        description: "המוצר נוסף למערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה ביצירת המוצר",
        variant: "destructive",
      });
      console.error('Error creating product:', error);
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...productData }: ProductUpdate & { id: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating product:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "מוצר עודכן בהצלחה",
        description: "השינויים נשמרו במערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בעדכון המוצר",
        variant: "destructive",
      });
      console.error('Error updating product:', error);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) {
        console.error('Error deleting product:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "מוצר נמחק בהצלחה",
        description: "המוצר הוסר מהמערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה במחיקת המוצר",
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
