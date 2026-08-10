import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const COST_CATEGORY_LABELS: Record<string, string> = {
  international_freight: 'הובלה בינלאומית',
  insurance: 'ביטוח',
  customs: 'מכס',
  taxes_fees: 'מיסים ואגרות',
  customs_broker: 'עמיל מכס',
  port: 'נמל',
  storage: 'אחסנה',
  local_transport: 'הובלה מקומית',
  standards_testing: 'תקינה ובדיקות',
  bank_fx_fees: 'עמלות בנק/המרה',
  other: 'אחר',
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: 'מקדמה',
  balance: 'יתרה',
  partial: 'תשלום חלקי',
  supplier_payment: 'תשלום לספק',
  freight_payment: 'תשלום הובלה',
  customs_payment: 'תשלום מכס',
  broker_payment: 'תשלום עמיל מכס',
  other: 'אחר',
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  commercial_invoice: 'חשבונית ספק',
  packing_list: 'רשימת אריזה',
  bill_of_lading: 'שטר מטען',
  shipping_invoice: 'חשבונית הובלה',
  customs_document: 'מסמך מכס',
  broker_invoice: 'חשבונית עמיל מכס',
  local_transport_invoice: 'חשבונית הובלה מקומית',
  other: 'אחר',
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  order_created: 'הזמנה נוצרה',
  status_changed: 'סטטוס שונה',
  eta_changed: 'תאריך הגעה משוער עודכן',
  cost_added: 'עלות נוספה',
  cost_updated: 'עלות עודכנה',
  cost_finalized: 'עלות סופית נקבעה',
  payment_added: 'תשלום נרשם',
  document_uploaded: 'מסמך הועלה',
  receiving_started: 'קליטה החלה',
  receipt_confirmed: 'קליטה אושרה',
  receipt_corrected: 'קליטה תוקנה',
  order_closed: 'הזמנה נסגרה',
  order_reopened: 'הזמנה נפתחה מחדש',
};

const BUCKET = 'import-documents';

export const useImportOrder = (orderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const order = useQuery({
    queryKey: ['import-order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_orders')
        .select('*, suppliers:supplier_id(id, name)')
        .eq('id', orderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const items = useQuery({
    queryKey: ['import-order-items', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_order_items')
        .select('*, brands:brand_id(id, name)')
        .eq('import_order_id', orderId!)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orderId,
  });

  const costs = useQuery({
    queryKey: ['import-order-costs', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_costs')
        .select('*')
        .eq('import_order_id', orderId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orderId,
  });

  const payments = useQuery({
    queryKey: ['import-order-payments', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_payments')
        .select('*')
        .eq('import_order_id', orderId!)
        .order('payment_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orderId,
  });

  const documents = useQuery({
    queryKey: ['import-order-documents', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_documents')
        .select('*')
        .eq('import_order_id', orderId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orderId,
  });

  const events = useQuery({
    queryKey: ['import-order-events', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_events')
        .select('*')
        .eq('import_order_id', orderId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orderId,
  });

  const landedCost = useQuery({
    queryKey: ['import-order-landed-cost', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('import_order_landed_cost', {
        p_import_order_id: orderId!,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orderId,
  });

  /**
   * Estimated vs final vs effective totals for the order.
   * `effective_total_ils` is the only figure landed cost consumes: per cost line
   * it is the final amount when one exists, otherwise the estimate — an estimate
   * and its own final value are never summed.
   */
  const costSummary = useQuery({
    queryKey: ['import-order-cost-summary', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('import_order_cost_summary', {
        p_import_order_id: orderId!,
      });
      if (error) throw error;
      return (data as any[])?.[0] ?? null;
    },
    enabled: !!orderId,
  });

  const invalidate = (keys: string[]) => {
    keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k, orderId] }));
    queryClient.invalidateQueries({ queryKey: ['import-orders-page'] });
    queryClient.invalidateQueries({ queryKey: ['import-order-events', orderId] });
    queryClient.invalidateQueries({ queryKey: ['import-order-landed-cost', orderId] });
    queryClient.invalidateQueries({ queryKey: ['import-order-cost-summary', orderId] });
  };

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from('import_orders')
        .update({
          status,
          closed_at: status === 'completed' || status === 'cancelled' ? new Date().toISOString() : null,
        })
        .eq('id', orderId!);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(['import-order']);
      toast({ title: 'הסטטוס עודכן' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  const addItem = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase
        .from('import_order_items')
        .insert({ ...payload, import_order_id: orderId, business_id: order.data?.business_id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(['import-order-items']);
      toast({ title: 'המוצר נוסף להזמנה' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  const addCost = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase
        .from('import_costs')
        .insert({ ...payload, import_order_id: orderId, business_id: order.data?.business_id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(['import-order-costs']);
      toast({ title: 'העלות נוספה' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  const addPayment = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase
        .from('import_payments')
        .insert({ ...payload, import_order_id: orderId, business_id: order.data?.business_id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(['import-order-payments']);
      toast({ title: 'התשלום נרשם' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  const uploadDocument = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const businessId = order.data?.business_id;
      if (!businessId || !orderId) throw new Error('missing order context');
      const docId = crypto.randomUUID();
      const safeName = file.name.replace(/[^\w.\-]/g, '_');
      // Tenant-scoped path — enforced by the storage RLS policies as well.
      const path = `${businessId}/${orderId}/${docId}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from('import_documents').insert({
        id: docId,
        import_order_id: orderId,
        business_id: businessId,
        document_type: documentType,
        storage_path: path,
        original_filename: file.name,
        mime_type: file.type || null,
        file_size: file.size,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(['import-order-documents']);
      toast({ title: 'המסמך הועלה' });
    },
    onError: (e: any) => toast({ title: 'שגיאה בהעלאה', description: e.message, variant: 'destructive' }),
  });

  /** Private bucket — access only through short-lived signed URLs. */
  const openDocument = async (storagePath: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 120);
    if (error || !data?.signedUrl) {
      toast({ title: 'לא ניתן לפתוח את המסמך', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return {
    order,
    items,
    costs,
    payments,
    documents,
    events,
    landedCost,
    updateStatus,
    addItem,
    addCost,
    addPayment,
    uploadDocument,
    openDocument,
  };
};
