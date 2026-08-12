import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const SHORTAGE_RESOLUTIONS = [
  'still_expected',
  'supplier_shortage',
  'cancelled',
  'credited',
  'other',
] as const;

export type ShortageResolution = (typeof SHORTAGE_RESOLUTIONS)[number];

export const SHORTAGE_RESOLUTION_LABELS: Record<ShortageResolution, string> = {
  still_expected: 'עדיין מצופה (נשאר בדרך)',
  supplier_shortage: 'חוסר אצל הספק (לא יגיע)',
  cancelled: 'בוטל',
  credited: 'זוכה',
  other: 'אחר',
};

export interface ReceiptLineDraft {
  import_order_item_id: string;
  received_quantity: number;
  notes?: string | null;
}

/**
 * Phase 2 — receiving workflow.
 *
 * INVARIANT: nothing in this hook mutates stock except `confirmReceipt`, which
 * calls the single server-side RPC `import_receipt_confirm`. Saving a draft is
 * pure data — it never touches products, inventory_actions or product cost.
 */
export const useImportReceiving = (orderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const receipts = useQuery({
    queryKey: ['import-receipts', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_receipts')
        .select('*')
        .eq('import_order_id', orderId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orderId,
  });

  const draft = ((receipts.data as any[]) ?? []).find((r) => r.status === 'draft') ?? null;

  const receiptIds = ((receipts.data as any[]) ?? []).map((r) => r.id);

  const receiptLines = useQuery({
    queryKey: ['import-receipt-lines', orderId, receiptIds.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_receipt_items')
        .select('*')
        .in('import_receipt_id', receiptIds)
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orderId && receiptIds.length > 0,
  });


  const draftLines = ((receiptLines.data as any[]) ?? []).filter(
    (l) => draft && l.import_receipt_id === draft.id
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['import-receipts', orderId] });
    queryClient.invalidateQueries({ queryKey: ['import-receipt-lines', orderId] });
    queryClient.invalidateQueries({ queryKey: ['import-order-items', orderId] });
    queryClient.invalidateQueries({ queryKey: ['import-order', orderId] });
    queryClient.invalidateQueries({ queryKey: ['import-order-events', orderId] });
    queryClient.invalidateQueries({ queryKey: ['import-orders-page'] });
  };

  const invalidateInventory = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-products-page'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['import-in-transit'] });
    queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
  };

  const startReceiving = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('import_receipt_start', {
        p_import_order_id: orderId!,
      });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'קליטה נפתחה' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  /** Draft only — explicitly does NOT move stock. */
  const saveDraft = useMutation({
    mutationFn: async ({ receiptId, lines }: { receiptId: string; lines: ReceiptLineDraft[] }) => {
      const { error } = await supabase.rpc('import_receipt_save_draft', {
        p_receipt_id: receiptId,
        p_lines: lines as unknown as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'הטיוטה נשמרה', description: 'המלאי לא עודכן' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  /** THE ONLY inventory-mutating action in the import module. */
  const confirmReceipt = useMutation({
    mutationFn: async (receiptId: string) => {
      const { data, error } = await supabase.rpc('import_receipt_confirm', {
        p_receipt_id: receiptId,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res: any) => {
      invalidate();
      invalidateInventory();
      toast({
        title: 'הקליטה אושרה והמלאי עודכן',
        description: `${res?.units ?? 0} יחידות ב-${res?.lines ?? 0} שורות`,
      });
    },
    onError: (e: any) =>
      toast({ title: 'הקליטה לא בוצעה', description: e.message, variant: 'destructive' }),
  });

  const cancelDraft = useMutation({
    mutationFn: async (receiptId: string) => {
      const { error } = await supabase.rpc('import_receipt_cancel_draft', { p_receipt_id: receiptId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'הטיוטה בוטלה' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  /** Post-confirmation correction — new ledger entry, original never rewritten. */
  const correctReceipt = useMutation({
    mutationFn: async ({
      receiptItemId,
      delta,
      reason,
    }: {
      receiptItemId: string;
      delta: number;
      reason: string;
    }) => {
      const { error } = await supabase.rpc('import_receipt_correct', {
        p_receipt_item_id: receiptItemId,
        p_quantity_delta: delta,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      invalidateInventory();
      toast({ title: 'התיקון נרשם והמלאי עודכן' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  const resolveShortage = useMutation({
    mutationFn: async ({
      itemId,
      resolution,
      quantity,
      notes,
    }: {
      itemId: string;
      resolution: ShortageResolution;
      quantity?: number | null;
      notes?: string | null;
    }) => {
      const { error } = await supabase.rpc('import_item_resolve_shortage', {
        p_item_id: itemId,
        p_resolution: resolution,
        p_quantity: quantity ?? null,
        p_notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['import-in-transit'] });
      toast({ title: 'סגירת החוסר נשמרה' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  /**
   * Creates a NEW tenant-owned product from an import line and links it.
   * The product is created with quantity 0 on purpose — stock only ever enters
   * through the atomic `import_receipt_confirm` RPC.
   */
  const createAndLinkProduct = useMutation({
    mutationFn: async ({
      item,
      name,
      barcode,
      price,
    }: {
      item: any;
      name: string;
      barcode?: string | null;
      price?: number | null;
    }) => {
      const cleanName = name.trim();
      if (!cleanName) throw new Error('נדרש שם מוצר');

      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) throw new Error('משתמש לא מזוהה');

      // Uniqueness guard — never create a duplicate name inside the same business.
      const { data: existing, error: existingError } = await supabase
        .from('products')
        .select('id')
        .eq('business_id', item.business_id)
        .ilike('name', cleanName)
        .limit(1);
      if (existingError) throw existingError;
      if (existing && existing.length > 0) {
        throw new Error('כבר קיים מוצר בשם זה — יש לקשר אליו במקום ליצור חדש');
      }

      const { data: product, error } = await supabase
        .from('products')
        .insert({
          name: cleanName,
          barcode: barcode?.trim() ? barcode.trim() : null,
          quantity: 0,
          cost: item.expected_unit_cost_ils ?? item.supplier_unit_cost ?? null,
          price: price ?? item.planned_sale_price_ils ?? null,
          brand_id: item.brand_id ?? null,
          business_id: item.business_id,
          created_by: userId,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: linkError } = await supabase
        .from('import_order_items')
        .update({ product_id: product.id })
        .eq('id', item.id);
      if (linkError) throw linkError;

      return product.id as string;
    },
    onSuccess: () => {
      invalidate();
      invalidateInventory();
      toast({ title: 'המוצר נוצר במלאי וקושר לפריט', description: 'הכמות תיכנס רק באישור הקליטה' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  /** Links an import line to an existing tenant-owned product. */
  const linkProduct = useMutation({
    mutationFn: async ({ itemId, productId }: { itemId: string; productId: string }) => {
      const { error } = await supabase
        .from('import_order_items')
        .update({ product_id: productId })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'הפריט קושר למוצר' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  return {
    receipts,
    receiptLines,
    draft,
    draftLines,
    startReceiving,
    saveDraft,
    confirmReceipt,
    cancelDraft,
    correctReceipt,
    resolveShortage,
    linkProduct,
    createAndLinkProduct,
  };
};
