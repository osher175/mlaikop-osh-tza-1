import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { EMPLOYEES_DIRECTORY_READY, LEGACY_SALE_ATTRIBUTION_READY, SALESPERSON_REPORT_READY } from '@/lib/v2/employeeAttribution';
import { loadQuickSaleFacts } from '@/lib/v2/quickSaleRead';
import {
  atomicLegacyCostKnown, employeeAnalytics, rangeToUtc, type AttributedSaleRow, type DayRange, type EmployeeAnalytics,
} from '@/lib/v2/dashboardMetrics';
import { employeeDiscountReport, type EmployeeDiscountReport, type StoredDiscountRow } from '@/lib/v2/saleDiscount';

const PAGE = 1000;
const MAX_ROWS = 20000;
const EMPTY_NAMES = new Map<string, string>();

export interface EmployeeAttributionResult {
  ready: boolean;
  analytics: EmployeeAnalytics | null;
  discounts: EmployeeDiscountReport | null;
  names: Map<string, string>;
  isLoading: boolean;
  isError: boolean;
  truncated: boolean;
  refetch: () => void;
}

/**
 * Reads a stored salesperson once either sales gate is on. Both are off today.
 * Migration A stored salesperson_employee_id as nullable. Null stays unattributed.
 * The signed-in user is never used as the salesperson.
 */
export function useEmployeeAttribution(range: DayRange, enabled: boolean): EmployeeAttributionResult {
  const { activeBusinessId } = useActiveBusiness();
  const query = useQuery({
    queryKey: ['v2-employee-attribution', activeBusinessId, range.from, range.to],
    queryFn: () => loadEmployeeAttribution(activeBusinessId!, range),
    enabled: SALESPERSON_REPORT_READY && !!activeBusinessId && enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  return {
    ready: SALESPERSON_REPORT_READY,
    analytics: query.data?.analytics ?? null,
    discounts: query.data?.discounts ?? null,
    names: query.data?.names ?? EMPTY_NAMES,
    isLoading: SALESPERSON_REPORT_READY && query.isLoading,
    isError: SALESPERSON_REPORT_READY && query.isError,
    truncated: query.data?.truncated ?? false,
    refetch: () => { void query.refetch(); },
  };
}

async function loadEmployeeAttribution(businessId: string, range: DayRange) {
  const { start, endExclusive } = rangeToUtc(range);
  const rows: AttributedSaleRow[] = [];
  let truncated = false;

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const page = await supabase
      .from('inventory_actions')
      .select('id, timestamp, product_id, quantity_changed, sale_total_ils, cost_snapshot_ils, salesperson_employee_id, reference_type, reference_id, list_unit_ils, discount_ils, discount_percent')
      .eq('business_id', businessId)
      .in('action_type', ['remove', 'sale'])
      .not('sale_total_ils', 'is', null)
      .eq('is_reversal', false)
      .is('reversed_at', null)
      .gte('timestamp', start)
      .lt('timestamp', endExclusive)
      .order('timestamp', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (page.error) throw page.error;
    const data = page.data ?? [];
    for (const row of data) {
      rows.push({
        timestamp: row.timestamp,
        product_id: row.product_id,
        quantity_changed: row.quantity_changed,
        sale_total_ils: row.sale_total_ils,
        cost_snapshot_ils: row.cost_snapshot_ils,
        salesperson_employee_id: row.salesperson_employee_id,
        cost_known: atomicLegacyCostKnown(row.reference_type, row.cost_snapshot_ils),
        transaction_id: row.reference_id ?? row.id,
        reference_type: row.reference_type,
        list_unit_ils: row.list_unit_ils,
        discount_ils: row.discount_ils,
        discount_percent: row.discount_percent,
      });
    }
    if (data.length < PAGE) break;
    if (offset + PAGE >= MAX_ROWS) truncated = true;
  }

  rows.push(...await loadQuickSaleFacts(businessId, range));

  const names = new Map<string, string>();
  if (EMPLOYEES_DIRECTORY_READY || LEGACY_SALE_ATTRIBUTION_READY) {
    const { data: employees, error: employeeError } = await supabase
      .from('employees')
      .select('id, display_name')
      .eq('business_id', businessId);
    if (employeeError) throw employeeError;
    for (const employee of employees ?? []) names.set(employee.id, employee.display_name);
  }

  const discountRows: StoredDiscountRow[] = rows.map((row) => ({
    referenceType: row.reference_type ?? null,
    listUnitIls: row.list_unit_ils ?? null,
    discountIls: row.discount_ils ?? null,
    discountPercent: row.discount_percent ?? null,
    salespersonEmployeeId: row.salesperson_employee_id,
    transactionId: row.transaction_id ?? null,
    productId: row.product_id,
    quantity: row.quantity_changed,
    saleTotalIls: row.sale_total_ils,
  }));
  return { analytics: employeeAnalytics(rows), discounts: employeeDiscountReport(discountRows), names, truncated };
}
