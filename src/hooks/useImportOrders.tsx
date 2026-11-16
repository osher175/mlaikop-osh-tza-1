import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useToast } from '@/hooks/use-toast';
import type { WizardOrderPayload } from '@/lib/v2/importOrderWizard';

export const IMPORT_STATUSES = [
  'ordered',
  'preparing',
  'shipped',
  'in_transit',
  'arrived_israel',
  'customs_clearance',
  'receiving',
  'received_pending_costs',
  'completed',
  'cancelled',
] as const;

export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  ordered: 'הוזמן',
  preparing: 'בהכנה',
  shipped: 'נשלח',
  in_transit: 'בדרך',
  arrived_israel: 'הגיע לישראל',
  customs_clearance: 'שחרור מכס',
  receiving: 'בקליטה',
  received_pending_costs: 'נקלט - ממתין לעלויות',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

export const PURCHASE_TYPE_LABELS: Record<string, string> = {
  direct_import: 'יבוא ישיר',
  parallel_import: 'יבוא מקביל',
};

export interface ImportOrderRow {
  id: string;
  import_number: string;
  supplier_id: string | null;
  supplier_name: string | null;
  purchase_type: string;
  status: ImportStatus;
  currency_code: string;
  order_date: string;
  estimated_arrival_date: string | null;
  ordered_units: number;
  received_units: number;
  goods_cost_ils: number;
  import_costs_ils: number;
  estimated_total_cost_ils: number;
  paid_ils: number;
  remaining_payment_ils: number;
  total_count: number;
}

export const IMPORT_PAGE_SIZE = 50;

interface PageArgs {
  scope: 'active' | 'completed' | 'all';
  search?: string;
  status?: string | null;
  page: number;
}

export const useImportOrdersPage = ({ scope, search, status, page }: PageArgs) => {
  const { activeBusinessId } = useActiveBusiness();

  return useQuery({
    queryKey: ['import-orders-page', activeBusinessId, scope, search ?? '', status ?? '', page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('import_orders_page', {
        p_business_id: activeBusinessId!,
        p_scope: scope,
        p_search: search?.trim() || null,
        p_status: status || null,
        p_limit: IMPORT_PAGE_SIZE,
        p_offset: page * IMPORT_PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data as unknown as ImportOrderRow[]) ?? [];
      return {
        rows,
        totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
      };
    },
    enabled: !!activeBusinessId,
    staleTime: 30 * 1000,
  });
};

export const useCreateImportOrder = () => {
  const { requireBusinessId } = useActiveBusiness();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: WizardOrderPayload) => {
      const businessId = requireBusinessId();
      if (!businessId) throw new Error('missing business');
      if (!input.lines?.length) throw new Error('חסרה שורת מוצר');
      // Commit goes through import_wizard_commit. That function is not applied yet.
      // A missing function fails the whole request, so no header or stock write happens.
      const { data, error } = await supabase.rpc('import_wizard_commit' as never, {
        p_payload: { ...input, business_id: businessId },
      } as never);
      if (error) throw error;
      const row = data as { id?: string } | null;
      if (!row?.id) throw new Error('השרת לא החזיר מזהה רשומה');
      return row;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-orders-page'] });
      queryClient.invalidateQueries({ queryKey: ['import-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-products-page'] });
      queryClient.invalidateQueries({ queryKey: ['import-incoming-summary'] });
      queryClient.invalidateQueries({ queryKey: ['import-in-transit'] });
      toast({ title: 'הזמנת היבוא נשמרה' });
    },
    onError: (error: any) => {
      toast({ title: 'שגיאה ביצירת הזמנה', description: error.message, variant: 'destructive' });
    },
  });
};

/**
 * Deletes an import order record. Destructive, so the server-side RPC
 * re-verifies the business import PIN and refuses orders that already moved
 * stock (confirmed receipts).
 */
export const useDeleteImportOrder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ orderId, pin }: { orderId: string; pin: string }) => {
      const { error } = await supabase.rpc('import_order_delete' as never, {
        p_order_id: orderId,
        p_pin: pin,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-orders-page'] });
      queryClient.invalidateQueries({ queryKey: ['import-dashboard'] });
      toast({ title: 'הזמנת היבוא נמחקה' });
    },
    onError: (error: any) => {
      const raw = error?.message ?? '';
      const description = raw.includes('Invalid PIN')
        ? 'הקוד הסודי שגוי'
        : raw.includes('temporarily locked')
          ? 'המודול ננעל זמנית עקב ניסיונות שגויים'
          : raw.includes('confirmed receipts')
            ? 'לא ניתן למחוק הזמנה שכבר נקלטה למלאי'
            : raw.includes('Access denied')
              ? 'אין לך הרשאה למחוק הזמנות יבוא'
              : raw;
      toast({ title: 'המחיקה לא בוצעה', description, variant: 'destructive' });
    },
  });
};
