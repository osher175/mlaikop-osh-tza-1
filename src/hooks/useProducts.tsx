
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Define local types
interface Product {
  id: string;
  name: string;
  quantity: number;
  price?: number;
  cost?: number;
  barcode?: string;
  location?: string;
  expiration_date?: string;
  business_id: string;
  created_by: string;
  supplier_id?: string;
  product_category_id?: string;
  image?: string;
  alert_dismissed?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CreateProductData {
  name: string;
  quantity: number;
  business_id: string;
  created_by: string;
  price?: number;
  cost?: number;
  barcode?: string;
  location?: string;
  expiration_date?: string;
  supplier_id?: string;
  product_category_id?: string;
  image?: string;
}

export const useProducts = (businessId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['products', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          suppliers(name),
          product_categories(name)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
      
      return data as Product[];
    },
    enabled: !!businessId,
  });

  const createProductMutation = useMutation({
    mutationFn: async (productData: CreateProductData) => {
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'מוצר נוצר בהצלחה',
        description: 'המוצר נוסף למערכת',
      });
    },
    onError: (error) => {
      console.error('Error creating product:', error);
      toast({
        title: 'שגיאה ביצירת המוצר',
        description: 'אירעה שגיאה ביצירת המוצר. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, ...productData }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'מוצר עודכן בהצלחה',
        description: 'המוצר עודכן במערכת',
      });
    },
    onError: (error) => {
      console.error('Error updating product:', error);
      toast({
        title: 'שגיאה בעדכון המוצר',
        description: 'אירעה שגיאה בעדכון המוצר. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'מוצר נמחק בהצלחה',
        description: 'המוצר הוסר מהמערכת',
      });
    },
    onError: (error) => {
      console.error('Error deleting product:', error);
      toast({
        title: 'שגיאה במחיקת המוצר',
        description: 'אירעה שגיאה במחיקת המוצר. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  return {
    products,
    isLoading,
    error,
    createProduct: createProductMutation.mutate,
    updateProduct: updateProductMutation.mutate,
    deleteProduct: deleteProductMutation.mutate,
    isCreating: createProductMutation.isPending,
    isUpdating: updateProductMutation.isPending,
    isDeleting: deleteProductMutation.isPending,
  };
};
