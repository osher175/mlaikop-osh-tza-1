import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { OPEN_STATUSES } from '@/constants/procurement';
import { atomicLegacyCostKnown, DEFAULT_LOW_STOCK_THRESHOLD, rangeToUtc, type DayRange, type SaleRow } from '@/lib/v2/dashboardMetrics';
import { QUICK_SALE_PERSISTENCE_READY } from '@/lib/v2/employeeAttribution';
import { loadQuickSaleFacts } from '@/lib/v2/quickSaleRead';
import type { ImportOrderRow } from '@/hooks/useImportOrders';

const PAGE = 1000;
const MAX_ROWS = 20000;

/**
 * Sale rows for one period. Same filters as reports_aggregate / yoy_financials:
 * action_type remove|sale, a recorded sale amount, reversals and reversed rows excluded.
 * `remove` without sale_total_ils is an inventory adjustment, not a sale.
 * Business scope is enforced by the business_id filter and by RLS. There is no branch column.
 */
async function fetchSales(businessId: string, range: DayRange) {
  const { start, endExclusive } = rangeToUtc(range);
  const rows: SaleRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await supabase
      .from('inventory_actions')
      .select('timestamp, product_id, quantity_changed, sale_total_ils, cost_snapshot_ils, reference_type')
      .eq('business_id', businessId)
      .in('action_type', ['remove', 'sale'])
      .not('sale_total_ils', 'is', null)
      .eq('is_reversal', false)
      .is('reversed_at', null)
      .gte('timestamp', start)
      .lt('timestamp', endExclusive)
      .order('timestamp', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page.map((row): SaleRow => ({
      timestamp: row.timestamp,
      product_id: row.product_id,
      quantity_changed: row.quantity_changed,
      sale_total_ils: row.sale_total_ils,
      cost_snapshot_ils: row.cost_snapshot_ils,
      cost_known: atomicLegacyCostKnown(row.reference_type, row.cost_snapshot_ils),
    })));
    if (page.length < PAGE) {
      if (!QUICK_SALE_PERSISTENCE_READY) return { rows, truncated: false };
      const extra = await loadQuickSaleFacts(businessId, range);
      return { rows: [...rows, ...extra], truncated: false };
    }
  }
  if (!QUICK_SALE_PERSISTENCE_READY) return { rows, truncated: true };
  const extra = await loadQuickSaleFacts(businessId, range);
  return { rows: [...rows, ...extra], truncated: true };
}

export const useDashboardSales = (range: DayRange, enabled: boolean) => {
  const { activeBusinessId } = useActiveBusiness();
  return useQuery({
    queryKey: ['v2-dashboard-sales', activeBusinessId, range.from, range.to],
    queryFn: () => fetchSales(activeBusinessId!, range),
    enabled: !!activeBusinessId && enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};

export interface StockProduct { id: string; name: string; quantity: number; image: string | null; threshold: number; thresholdConfigured: boolean }

export const useDashboardStock = (enabled: boolean) => {
  const { activeBusinessId } = useActiveBusiness();
  return useQuery({
    queryKey: ['v2-dashboard-stock', activeBusinessId],
    queryFn: async () => {
      const products: { id: string; name: string; quantity: number; image: string | null }[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await supabase
          .from('products').select('id, name, quantity, image')
          .eq('business_id', activeBusinessId!).order('id').range(offset, offset + PAGE - 1);
        if (error) throw error;
        products.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      const { data: th, error: thErr } = await supabase
        .from('product_thresholds').select('product_id, low_stock_threshold').eq('business_id', activeBusinessId!);
      if (thErr) throw thErr;
      const tmap = new Map((th ?? []).map((t) => [t.product_id as string, t.low_stock_threshold as number]));
      return products.map<StockProduct>((p) => ({
        ...p,
        threshold: tmap.get(p.id) ?? DEFAULT_LOW_STOCK_THRESHOLD,
        thresholdConfigured: tmap.has(p.id),
      }));
    },
    enabled: !!activeBusinessId && enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};

export const useDashboardActiveImport = (enabled: boolean) => {
  const { activeBusinessId } = useActiveBusiness();
  return useQuery({
    queryKey: ['v2-dashboard-import', activeBusinessId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('import_orders_page', {
        p_business_id: activeBusinessId!, p_scope: 'active', p_search: null, p_status: null, p_limit: 1, p_offset: 0,
      });
      if (error) throw error;
      const rows = (data ?? []) as unknown as ImportOrderRow[];
      return { current: rows[0] ?? null, activeCount: rows[0]?.total_count ?? 0 };
    },
    enabled: !!activeBusinessId && enabled,
    staleTime: 0,
  });
};

export const useOpenProcurementCount = (enabled: boolean) => {
  const { activeBusinessId } = useActiveBusiness();
  return useQuery({
    queryKey: ['v2-dashboard-procurement-open', activeBusinessId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('procurement_requests').select('id', { count: 'exact', head: true })
        .eq('business_id', activeBusinessId!).in('status', OPEN_STATUSES as unknown as string[]);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!activeBusinessId && enabled,
    staleTime: 0,
  });
};
