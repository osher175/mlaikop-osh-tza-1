import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { rangeToUtc, type DayRange } from '@/lib/v2/dashboardMetrics';
import { asSaleRows, loadQuickSaleFacts } from '@/lib/v2/quickSaleRead';
import {
  isLegacySale, moneyFromSales, toSaleRow, type JournalAction, type JournalKind, type JournalMoney,
} from '@/lib/v2/movementJournal';

const PAGE_SIZE = 25;
const MONEY_PAGE = 1000;
const MONEY_MAX = 20000;
const COLUMNS = 'id, timestamp, action_type, product_id, quantity_changed, sale_unit_ils, sale_total_ils, purchase_unit_ils, purchase_total_ils, cost_snapshot_ils, supplier_id, salesperson_employee_id, reference_id, reference_type, reference_meta, notes, is_reversal, reversed_at, reverses_action_id, source, user_id';
const PRODUCT_FILTER_LIMIT = 150;
const SUPPLIER_PAGE = 1000;

export interface JournalFilters {
  range: DayRange;
  kind: JournalKind;
  supplierId: string | null;
  employeeId: string;
  search: string;
  page: number;
}

export interface JournalPage {
  rows: JournalAction[];
  total: number;
  searchIncomplete: boolean;
  names: { products: Map<string, string>; suppliers: Map<string, string>; employees: Map<string, string> };
}

const safeTerm = (value: string) => value.replace(/[%_,.()]/g, '').trim();
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type Filtered = {
  eq: (column: string, value: string | boolean) => Filtered;
  gte: (column: string, value: string) => Filtered;
  lt: (column: string, value: string) => Filtered;
  in: (column: string, values: string[]) => Filtered;
  is: (column: string, value: null) => Filtered;
  not: (column: string, operator: string, value: string | null) => Filtered;
  or: (filters: string) => Filtered;
  order: (column: string, options: { ascending: boolean }) => Filtered;
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null; count: number | null }>;
  then: PromiseLike<{ data: unknown[] | null; error: { message: string } | null; count: number | null }>['then'];
};

function withOr(query: Filtered, groups: string[]): Filtered {
  if (groups.length === 0) return query;
  if (groups.length === 1) return query.or(groups[0]);
  return query.or(`and(${groups.map((group) => `or(${group})`).join(',')})`);
}

function applyScope(query: Filtered, businessId: string, filters: JournalFilters, productIds: string[]): Filtered {
  const { start, endExclusive } = rangeToUtc(filters.range);
  let next = query.eq('business_id', businessId).gte('timestamp', start).lt('timestamp', endExclusive);
  if (filters.supplierId) next = next.eq('supplier_id', filters.supplierId);
  if (filters.employeeId === 'unattributed') next = next.is('salesperson_employee_id', null);
  else if (filters.employeeId !== 'all') next = next.eq('salesperson_employee_id', filters.employeeId);

  const groups: string[] = [];
  if (filters.kind === 'reversal') next = next.eq('is_reversal', true);
  if (filters.kind === 'sale') {
    next = next.eq('is_reversal', false).is('reversed_at', null);
    groups.push('and(action_type.in.(remove,sale),sale_total_ils.not.is.null),and(reference_type.eq.sale_transaction,sale_total_ils.is.null)');
  }
  if (filters.kind === 'purchase') {
    next = next.in('action_type', ['add', 'purchase']).eq('is_reversal', false);
    groups.push('purchase_total_ils.not.is.null,purchase_unit_ils.not.is.null,reference_type.eq.purchase_receipt');
  }
  if (filters.kind === 'supplier_return') next = next.eq('is_reversal', false).eq('reference_type', 'supplier_return');
  if (filters.kind === 'customer_return') next = next.eq('is_reversal', false).eq('reference_type', 'customer_return');
  if (filters.kind === 'adjustment') {
    next = next.eq('is_reversal', false).in('action_type', ['add', 'remove', 'purchase', 'sale', 'adjust']).is('sale_total_ils', null).is('purchase_total_ils', null).is('purchase_unit_ils', null);
    groups.push('reference_type.is.null,reference_type.neq.sale_transaction');
  }
  if (filters.kind === 'other') {
    next = next.eq('is_reversal', false).not('action_type', 'in', '(add,remove,purchase,sale,adjust)');
    groups.push('reference_type.is.null,reference_type.not.in.(supplier_return,customer_return,purchase_receipt,stock_adjustment)');
  }

  const term = safeTerm(filters.search);
  if (term) {
    const parts = [`notes.ilike.%${term}%`];
    if (productIds.length) parts.push(`product_id.in.(${productIds.join(',')})`);
    if (isUuid(term)) parts.push(`reference_id.eq.${term}`, `id.eq.${term}`);
    groups.push(parts.join(','));
  }
  return withOr(next, groups);
}

function listed(columns: string, options?: { count?: 'exact'; head?: boolean }) {
  return supabase.from('inventory_actions').select(columns, options) as unknown as Filtered;
}

async function matchingProductIds(businessId: string, search: string): Promise<{ ids: string[]; incomplete: boolean }> {
  const term = safeTerm(search);
  if (!term) return { ids: [], incomplete: false };
  const ids: string[] = [];
  for (let offset = 0; offset <= PRODUCT_FILTER_LIMIT; offset += 1000) {
    const { data, error } = await supabase.from('products').select('id').eq('business_id', businessId).or(`name.ilike.%${term}%,barcode.ilike.%${term}%`).order('id', { ascending: true }).range(offset, offset + 999);
    if (error) throw error;
    const batch = data ?? [];
    ids.push(...batch.map((row) => row.id));
    if (ids.length > PRODUCT_FILTER_LIMIT) return { ids: [], incomplete: true };
    if (batch.length < 1000) return { ids, incomplete: false };
  }
  return { ids: [], incomplete: true };
}

async function countKind(businessId: string, filters: JournalFilters, kind: JournalKind, productIds: string[]) {
  const query = applyScope(listed('id', { count: 'exact', head: true }), businessId, { ...filters, kind }, productIds);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export function useMovementJournal(filters: JournalFilters) {
  const { activeBusinessId, isLoading: businessLoading } = useActiveBusiness();
  const page = useQuery({
    queryKey: ['v2-movement-journal', activeBusinessId, filters],
    enabled: !!activeBusinessId,
    queryFn: async (): Promise<JournalPage> => {
      const businessId = activeBusinessId!;
      const matched = await matchingProductIds(businessId, filters.search);
      if (matched.incomplete) return { rows: [], total: 0, searchIncomplete: true, names: { products: new Map(), suppliers: new Map(), employees: new Map() } };
      const productIds = matched.ids;
      const from = (filters.page - 1) * PAGE_SIZE;
      const listedPage = applyScope(listed(COLUMNS, { count: 'exact' }), businessId, filters, productIds)
        .order('timestamp', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      const { data, error, count } = await listedPage;
      if (error) throw error;
      const rows = (data ?? []) as JournalAction[];
      const productSet = [...new Set(rows.map((row) => row.product_id))];
      const supplierSet = [...new Set(rows.flatMap((row) => row.supplier_id ? [row.supplier_id] : []))];
      const employeeSet = [...new Set(rows.flatMap((row) => row.salesperson_employee_id ? [row.salesperson_employee_id] : []))];
      const [products, suppliers, employees] = await Promise.all([
        productSet.length ? supabase.from('products').select('id, name').eq('business_id', businessId).in('id', productSet) : Promise.resolve({ data: [], error: null }),
        supplierSet.length ? supabase.from('suppliers').select('id, name').eq('business_id', businessId).in('id', supplierSet) : Promise.resolve({ data: [], error: null }),
        employeeSet.length ? supabase.from('employees').select('id, display_name').eq('business_id', businessId).in('id', employeeSet) : Promise.resolve({ data: [], error: null }),
      ]);
      if (products.error) throw products.error;
      if (suppliers.error) throw suppliers.error;
      return {
        rows,
        total: count ?? 0,
        searchIncomplete: false,
        names: {
          products: new Map((products.data ?? []).map((row) => [row.id, row.name])),
          suppliers: new Map((suppliers.data ?? []).map((row) => [row.id, row.name])),
          employees: employees.error ? new Map() : new Map((employees.data ?? []).map((row) => [row.id, row.display_name])),
        },
      };
    },
  });

  const counts = useQuery({
    queryKey: ['v2-movement-counts', activeBusinessId, filters.range, filters.supplierId, filters.employeeId, filters.search, filters.kind],
    enabled: !!activeBusinessId,
    queryFn: async () => {
      const businessId = activeBusinessId!;
      const matched = await matchingProductIds(businessId, filters.search);
      if (matched.incomplete) return { total: 0, adjustments: 0, purchases: 0, supplierReturns: 0, searchIncomplete: true };
      const productIds = matched.ids;
      const [total, adjustments, purchases, supplierReturns] = await Promise.all([
        countKind(businessId, filters, filters.kind, productIds),
        filters.kind === 'all' || filters.kind === 'adjustment' ? countKind(businessId, filters, 'adjustment', productIds) : Promise.resolve(0),
        filters.kind === 'all' || filters.kind === 'purchase' ? countKind(businessId, filters, 'purchase', productIds) : Promise.resolve(0),
        filters.kind === 'all' || filters.kind === 'supplier_return' ? countKind(businessId, filters, 'supplier_return', productIds) : Promise.resolve(0),
      ]);
      return { total, adjustments, purchases, supplierReturns, searchIncomplete: false };
    },
  });

  const money = useQuery({
    queryKey: ['v2-movement-money', activeBusinessId, filters.range, filters.supplierId, filters.employeeId, filters.search, filters.kind],
    enabled: !!activeBusinessId && (filters.kind === 'all' || filters.kind === 'sale'),
    queryFn: async (): Promise<JournalMoney> => {
      const businessId = activeBusinessId!;
      const matched = await matchingProductIds(businessId, filters.search);
      if (matched.incomplete) return moneyFromSales([], true);
      const productIds = matched.ids;
      const rows: JournalAction[] = [];
      for (let offset = 0; offset < MONEY_MAX; offset += MONEY_PAGE) {
        const query = applyScope(listed(COLUMNS), businessId, { ...filters, kind: 'sale' }, productIds)
          .order('timestamp', { ascending: true })
          .range(offset, offset + MONEY_PAGE - 1);
        const { data, error } = await query;
        if (error) throw error;
        const batch = (data ?? []) as JournalAction[];
        rows.push(...batch.filter(isLegacySale));
        if (batch.length < MONEY_PAGE) {
          const extra = (await loadQuickSaleFacts(businessId, filters.range)).filter((row) => {
            if (filters.supplierId) return false;
            if (filters.employeeId === 'unattributed') return !row.salesperson_employee_id;
            if (filters.employeeId !== 'all' && row.salesperson_employee_id !== filters.employeeId) return false;
            const term = safeTerm(filters.search);
            if (term && !productIds.includes(row.product_id)) return false;
            return true;
          });
          return moneyFromSales([...rows.map(toSaleRow), ...asSaleRows(extra)], false);
        }
      }
      return moneyFromSales(rows.map(toSaleRow), true);
    },
  });

  return { businessLoading, page, counts, money, pageSize: PAGE_SIZE };
}

export function useJournalSuppliers() {
  const { activeBusinessId } = useActiveBusiness();
  return useQuery({
    queryKey: ['v2-movement-suppliers', activeBusinessId],
    enabled: !!activeBusinessId,
    queryFn: async () => {
      const rows: { id: string; name: string }[] = [];
      for (let offset = 0; offset < 5000; offset += SUPPLIER_PAGE) {
        const { data, error } = await supabase.from('suppliers').select('id, name').eq('business_id', activeBusinessId!).order('id', { ascending: true }).range(offset, offset + SUPPLIER_PAGE - 1);
        if (error) throw error;
        const batch = data ?? [];
        rows.push(...batch);
        if (batch.length < SUPPLIER_PAGE) return { suppliers: rows.sort((a, b) => a.name.localeCompare(b.name, 'he')), incomplete: false };
      }
      return { suppliers: rows, incomplete: true };
    },
  });
}
