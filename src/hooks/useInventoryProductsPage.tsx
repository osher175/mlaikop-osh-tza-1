import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

export type InventoryProduct = Database['public']['Tables']['products']['Row'] & {
  product_categories?: { name: string } | null;
  suppliers?: { name: string } | null;
  product_thresholds?: { low_stock_threshold: number } | null;
};

export type StockFilter = 'all' | 'inStock' | 'lowStock' | 'outOfStock';

interface PageResult {
  items: InventoryProduct[];
  total: number;
}

const EXPORT_BATCH = 1000;

export const fetchInventoryPage = async (
  businessId: string,
  search: string,
  stockFilter: StockFilter,
  limit: number,
  offset: number
): Promise<PageResult> => {
  const { data, error } = await supabase.rpc('inventory_products_page', {
    p_business_id: businessId,
    p_search: search || null,
    p_stock_filter: stockFilter,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;

  const payload = (data ?? {}) as { items?: InventoryProduct[]; total?: number };
  return {
    items: payload.items ?? [],
    total: Number(payload.total ?? 0),
  };
};

/**
 * Phase A5.1 — bounded, server-side paginated product list.
 * Search / stock filtering / ordering all happen in Postgres, so the browser
 * never loads the full catalog and PostgREST's 1,000-row cap can't truncate.
 */
export const useInventoryProductsPage = (
  search: string,
  stockFilter: StockFilter,
  page: number,
  pageSize: number
) => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id;

  const query = useQuery({
    queryKey: ['inventory-products-page', businessId, search, stockFilter, page, pageSize],
    queryFn: async () => {
      if (!businessId) return { items: [], total: 0 } as PageResult;
      return fetchInventoryPage(businessId, search, stockFilter, pageSize, (page - 1) * pageSize);
    },
    enabled: !!user?.id && !!businessId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  return {
    products: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};

/** Global counters computed in the database over the whole tenant catalog. */
export const useInventoryStockCounts = () => {
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id;

  const query = useQuery({
    queryKey: ['inventory-stock-counts', businessId],
    queryFn: async () => {
      if (!businessId) return { total: 0, inStock: 0, lowStock: 0, outOfStock: 0, totalUnits: 0 };
      const { data, error } = await supabase.rpc('inventory_stock_counts', {
        p_business_id: businessId,
      });
      if (error) throw error;
      const v = (data ?? {}) as Record<string, number>;
      return {
        total: Number(v.total ?? 0),
        inStock: Number(v.inStock ?? 0),
        lowStock: Number(v.lowStock ?? 0),
        outOfStock: Number(v.outOfStock ?? 0),
        totalUnits: Number(v.totalUnits ?? 0),
      };
    },
    enabled: !!businessId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    counts: query.data ?? { total: 0, inStock: 0, lowStock: 0, outOfStock: 0, totalUnits: 0 },
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

/**
 * Fetches every product matching the current filters, in bounded batches.
 * Used by the Excel export so it never depends on one unbounded query.
 */
export const fetchAllMatchingProducts = async (
  businessId: string,
  search: string,
  stockFilter: StockFilter
): Promise<InventoryProduct[]> => {
  const all: InventoryProduct[] = [];
  let offset = 0;

  // Hard safety ceiling: 100 batches = 100,000 products
  for (let i = 0; i < 100; i++) {
    const { items, total } = await fetchInventoryPage(
      businessId,
      search,
      stockFilter,
      EXPORT_BATCH,
      offset
    );
    all.push(...items);
    offset += EXPORT_BATCH;
    if (items.length < EXPORT_BATCH || all.length >= total) break;
  }

  return all;
};

/** Invalidate every product-scale query after a mutation. */
export const useInvalidateInventory = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-products-page'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };
};
