import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusinessAccess } from './useBusinessAccess';
import { useToast } from '@/hooks/use-toast';
import { useInventoryLogger } from './useInventoryLogger';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export const useProducts = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logInventoryAction } = useInventoryLogger();

  const { data: products = [], isLoading, error, refetch } = useQuery({
    queryKey: ['products', businessContext?.business_id],
    queryFn: async () => {
      if (!user?.id || !businessContext?.business_id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_categories(name),
          product_thresholds(low_stock_threshold)
        `)
        .eq('business_id', businessContext.business_id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!user?.id && !!businessContext?.business_id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const createProduct = useMutation({
    mutationFn: async (productData: Omit<ProductInsert, 'business_id' | 'created_by'> & { low_stock_threshold?: number }) => {
      if (!user?.id || !businessContext?.business_id) {
        throw new Error('User or business not found');
      }
      
      const { low_stock_threshold, ...productFields } = productData;
      
      console.log('Creating product with threshold:', low_stock_threshold);
      
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...productFields,
          business_id: businessContext.business_id,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating product:', error);
        throw error;
      }

      // Insert threshold if provided
      if (low_stock_threshold !== undefined) {
        console.log('Inserting threshold for product:', data.id, 'with threshold:', low_stock_threshold);
        
        const { error: thresholdError } = await supabase
          .from('product_thresholds')
          .insert({
            product_id: data.id,
            business_id: businessContext.business_id,
            low_stock_threshold,
          });
          
        if (thresholdError) {
          console.error('Error inserting threshold:', thresholdError);
          // Don't fail the entire operation for threshold error
        }
      }

      // Log inventory action for initial stock
      if (productData.quantity && productData.quantity > 0) {
        await logInventoryAction(
          data.id, 
          'add', 
          productData.quantity,
          `הוספת מוצר חדש עם ${productData.quantity} יחידות ראשוניות`
        );
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
      queryClient.invalidateQueries({ queryKey: ['bi-analytics'] });
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
      
      console.log('Updating product:', id, 'with data:', productData);
      
      // Get current product data to compare quantities
      const { data: currentProduct } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', id)
        .single();
      
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

      // Log inventory action if quantity changed
      if (currentProduct && productData.quantity !== undefined && productData.quantity !== currentProduct.quantity) {
        const quantityDiff = productData.quantity - currentProduct.quantity;
        const actionType = quantityDiff > 0 ? 'add' : 'remove';
        const notes = quantityDiff > 0 
          ? `הוספת ${Math.abs(quantityDiff)} יחידות למלאי`
          : `הפחתת ${Math.abs(quantityDiff)} יחידות מהמלאי`;
        
        await logInventoryAction(id, actionType, Math.abs(quantityDiff), notes);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
      queryClient.invalidateQueries({ queryKey: ['bi-analytics'] });
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
      queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
      queryClient.invalidateQueries({ queryKey: ['bi-analytics'] });
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
