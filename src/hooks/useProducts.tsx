
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useInventoryLogger } from '@/hooks/useInventoryLogger';

// Define consistent Product type
export interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  quantity: number;
  price?: number | null;
  cost?: number | null;
  location?: string | null;
  expiration_date?: string | null;
  business_id: string;
  created_by: string;
  supplier_id?: string | null;
  product_category_id?: string | null;
  image?: string | null;
  alert_dismissed: boolean;
  enable_whatsapp_supplier_notification: boolean;
  created_at?: string;
  updated_at?: string;
  product_categories?: { name: string } | null;
  product_thresholds?: { low_stock_threshold: number } | null;
}

export interface CreateProductData {
  name: string;
  barcode?: string;
  quantity?: number;
  price?: number;
  cost?: number;
  location?: string;
  expiration_date?: string;
  supplier_id?: string;
  product_category_id?: string;
  image?: string;
  enable_whatsapp_supplier_notification?: boolean;
  low_stock_threshold?: number;
}

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
      
      return (data || []).map(item => ({
        ...item,
        alert_dismissed: item.alert_dismissed || false,
        enable_whatsapp_supplier_notification: item.enable_whatsapp_supplier_notification || false
      })) as Product[];
    },
    enabled: !!user?.id && !!businessContext?.business_id,
  });

  const createProduct = useMutation({
    mutationFn: async (productData: CreateProductData) => {
      if (!user?.id || !businessContext?.business_id) {
        throw new Error('User or business not found');
      }
      
      const { low_stock_threshold, ...productFields } = productData;
      
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...productFields,
          business_id: businessContext.business_id,
          created_by: user.id,
          alert_dismissed: false,
          enable_whatsapp_supplier_notification: productData.enable_whatsapp_supplier_notification || false
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating product:', error);
        throw error;
      }

      // Insert threshold if provided
      if (low_stock_threshold !== undefined) {
        await supabase
          .from('product_thresholds')
          .insert({
            product_id: data.id,
            business_id: businessContext.business_id,
            low_stock_threshold,
          });
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
    mutationFn: async ({ id, ...productData }: Partial<Product> & { id: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
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
