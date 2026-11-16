import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusinessAccess } from './useBusinessAccess';
import { useToast } from '@/hooks/use-toast';
import {
  EDITOR_OPERATION,
  openingAttemptSignature,
  planOpeningStock,
  resumeOpeningAttempt,
  rpcIsMissing,
  type OpeningAttempt,
} from '@/lib/v2/legacyInventoryWrite';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];

const openingStorageKey = (businessId: string) => `mlaiko.product-opening.${businessId}`;

function readOpeningAttempt(key: string): OpeningAttempt | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OpeningAttempt;
    if (!parsed?.signature || !parsed.operationId) return null;
    return { signature: parsed.signature, operationId: parsed.operationId, productId: parsed.productId ?? null };
  } catch {
    return null;
  }
}

function writeOpeningAttempt(key: string, attempt: OpeningAttempt) {
  sessionStorage.setItem(key, JSON.stringify(attempt));
}

function clearOpeningAttempt(key: string) {
  sessionStorage.removeItem(key);
}

export const useProducts = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createInFlight = useRef(false);

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
      
      if (createInFlight.current) throw new Error('השמירה כבר רצה');
      createInFlight.current = true;
      try {
      const { low_stock_threshold, ...productFields } = productData;
      const opening = planOpeningStock({
        quantity: productData.quantity ?? 0,
        unitCost: productData.cost ?? null,
        supplierId: productData.supplier_id ?? null,
      });
      if (opening.error) throw new Error(opening.error);

      const signature = openingAttemptSignature({
        businessId: businessContext.business_id,
        name: productData.name ?? '',
        barcode: productData.barcode ?? null,
        quantity: productData.quantity ?? 0,
        unitCost: productData.cost ?? null,
      });
      const storageKey = openingStorageKey(businessContext.business_id);
      const pending = readOpeningAttempt(storageKey);
      const attempt = resumeOpeningAttempt(pending, signature, crypto.randomUUID());
      writeOpeningAttempt(storageKey, attempt);

      const atomic = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: { product_id?: string } | null; error: { code?: string; message: string } | null }>)(
        'create_product_with_opening_stock',
        {
          p_operation_id: attempt.operationId,
          p_business_id: businessContext.business_id,
          p_name: productData.name,
          p_barcode: productData.barcode ?? null,
          p_price: productData.price ?? null,
          p_cost: productData.cost ?? null,
          p_location: productData.location ?? null,
          p_expiration_date: productData.expiration_date ?? null,
          p_image: productData.image ?? null,
          p_product_category_id: productData.product_category_id ?? null,
          p_supplier_id: productData.supplier_id ?? null,
          p_quantity: productData.quantity ?? 0,
          p_low_stock_threshold: low_stock_threshold ?? null,
          p_enable_whatsapp_supplier_notification: productData.enable_whatsapp_supplier_notification ?? false,
        },
      );
      if (!atomic.error) {
        if (!atomic.data?.product_id) throw new Error('הפעולה נכשלה. לא התקבל אישור מהשרת.');
        clearOpeningAttempt(storageKey);
        return { id: atomic.data.product_id } as Product;
      }
      if (!rpcIsMissing(atomic.error)) throw atomic.error;

      console.log('Creating product with threshold:', low_stock_threshold);

      let productId = attempt.productId;
      let created = null as Product | null;
      if (!productId) {
        const { data, error } = await supabase
          .from('products')
          .insert({
            ...productFields,
            quantity: 0,
            business_id: businessContext.business_id,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) {
          console.error('Error creating product:', error);
          throw error;
        }
        productId = data.id;
        created = data;
        writeOpeningAttempt(storageKey, { ...attempt, productId });
      }

      if (opening.stock && productId) {
        const stock = opening.stock;
        const { error: stockError } = await supabase.rpc('execute_inventory_transaction', {
          p_business_id: businessContext.business_id,
          p_user_id: user.id,
          p_product_id: productId,
          p_action_type: stock.actionType,
          p_quantity_changed: stock.quantityChanged,
          p_purchase_unit_ils: stock.purchaseUnitIls,
          p_purchase_total_ils: stock.purchaseTotalIls,
          p_supplier_id: stock.supplierId ?? undefined,
          p_notes: stock.notes,
          p_source: 'product_opening',
          p_reference_type: EDITOR_OPERATION,
          p_reference_id: attempt.operationId,
        });
        if (stockError) {
          throw new Error(`המוצר נוצר ללא מלאי ראשוני. אותה בקשה לא תיצור מוצר שני. ${stockError.message}`);
        }
      }

      if (low_stock_threshold !== undefined && productId) {
        const { error: thresholdError } = await supabase
          .from('product_thresholds')
          .upsert({
            product_id: productId,
            business_id: businessContext.business_id,
            low_stock_threshold,
          }, { onConflict: 'product_id' });
        if (thresholdError) console.error('Error inserting threshold:', thresholdError);
      }

      clearOpeningAttempt(storageKey);
      return created ?? ({ id: productId } as Product);
      } finally {
        createInFlight.current = false;
      }
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
    deleteProduct,
  };
};
