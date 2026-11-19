import { atomicLegacyCostKnown, summarize, type PeriodSummary, type SaleRow } from '@/lib/v2/dashboardMetrics';

/**
 * Read-model labels for inventory_actions. This does not create movements.
 * A stored balance exists only when the movement wrote stock_before and
 * stock_after. Older rows stay unavailable.
 */
export type JournalKind = 'all' | 'sale' | 'purchase' | 'adjustment' | 'supplier_return' | 'customer_return' | 'reversal' | 'other';

export interface JournalAction {
  id: string;
  timestamp: string | null;
  action_type: string;
  product_id: string;
  quantity_changed: number;
  sale_unit_ils: number | null;
  sale_total_ils: number | null;
  purchase_unit_ils: number | null;
  purchase_total_ils: number | null;
  cost_snapshot_ils: number | null;
  supplier_id: string | null;
  salesperson_employee_id: string | null;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  is_reversal: boolean;
  reversed_at: string | null;
  reverses_action_id: string | null;
  source: string | null;
  user_id: string;
  reference_meta: { [key: string]: unknown } | null;
  /** Display only. Copied from the linked sale. Not written to inventory_actions. */
  display_salesperson_employee_id?: string | null;
  /** Display only. One linked sale line. Not written to sale_total_ils. */
  display_line_revenue_gross_ils?: number | null;
}

const QUICK_SALE_REFERENCE = 'sale_transaction';

export const isQuickSaleStockMove = (row: Pick<JournalAction, 'reference_type' | 'sale_total_ils'>) =>
  row.reference_type === QUICK_SALE_REFERENCE && row.sale_total_ils === null;

/** Legacy sale grain: one inventory row with a stored sale amount. Not a quick-sale stock row. */
export const isLegacySale = (row: JournalAction) =>
  !row.is_reversal
  && row.reversed_at === null
  && (row.action_type === 'sale' || row.action_type === 'remove')
  && row.sale_total_ils !== null;

export const isSupplierReturn = (row: JournalAction) =>
  !row.is_reversal && row.reference_type === 'supplier_return';

export const isCustomerReturn = (row: JournalAction) =>
  !row.is_reversal && row.reference_type === 'customer_return';

export const isPurchaseReceipt = (row: JournalAction) =>
  !row.is_reversal
  && !isSupplierReturn(row)
  && (
    row.reference_type === 'purchase_receipt'
    || (
      (row.action_type === 'add' || row.action_type === 'purchase')
      && (row.purchase_total_ils !== null || row.purchase_unit_ils !== null)
    )
  );

export const isAdjustment = (row: JournalAction) =>
  !row.is_reversal
  && row.reversed_at === null
  && !isLegacySale(row)
  && !isPurchaseReceipt(row)
  && !isQuickSaleStockMove(row)
  && !isSupplierReturn(row)
  && !isCustomerReturn(row)
  && ['add', 'remove', 'purchase', 'sale', 'adjust'].includes(row.action_type);

export const classifyJournal = (row: JournalAction): Exclude<JournalKind, 'all'> => {
  if (row.is_reversal) return 'reversal';
  if (isSupplierReturn(row)) return 'supplier_return';
  if (isCustomerReturn(row)) return 'customer_return';
  if (isLegacySale(row)) return 'sale';
  if (isPurchaseReceipt(row)) return 'purchase';
  if (isQuickSaleStockMove(row)) return 'sale';
  if (isAdjustment(row)) return 'adjustment';
  return 'other';
};

export const kindLabel = (kind: Exclude<JournalKind, 'all'>): string => {
  switch (kind) {
    case 'sale': return 'מכירה';
    case 'purchase': return 'קליטת רכש';
    case 'adjustment': return 'התאמת מלאי';
    case 'supplier_return': return 'החזרה לספק';
    case 'customer_return': return 'החזרת לקוח';
    case 'reversal': return 'ביטול תנועה';
    default: return 'תנועה אחרת';
  }
};

/**
 * Older rows treat a missing or zero snapshot as unknown.
 * An atomic legacy sale keeps a stored 0 and uses null only for unknown cost.
 */
export const knownUnitCost = (row: Pick<JournalAction, 'cost_snapshot_ils' | 'reference_type'>): number | null => {
  if (row.reference_type === 'legacy_sale_request') return row.cost_snapshot_ils;
  return row.cost_snapshot_ils !== null && row.cost_snapshot_ils > 0 ? row.cost_snapshot_ils : null;
};

export const movementTotal = (row: JournalAction): number | null => {
  if (isLegacySale(row)) return row.sale_total_ils;
  if (isPurchaseReceipt(row)) return row.purchase_total_ils;
  if (isQuickSaleStockMove(row)) return row.display_line_revenue_gross_ils ?? null;
  return null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface QuickSaleLink {
  id: string;
  businessId: string;
  salespersonEmployeeId: string | null;
}

export interface QuickSaleLineLink {
  inventoryActionId: string;
  transactionId: string;
  businessId: string;
  lineRevenueGrossIls: number | null;
}

export type EmployeeScope =
  | { mode: 'all' }
  | { mode: 'unattributed'; orGroup: string | null }
  | { mode: 'employee'; orGroup: string };

const one = <T>(items: T[]): T | null => (items.length === 1 ? items[0] : null);

/**
 * Quick-sale rows keep a null movement employee and a null sale_total_ils.
 * The employee comes from the one sale in this business. The amount comes
 * from the one sale line linked to this movement. Any other shape stays
 * unavailable. sale_total_ils is left untouched.
 */
export function attachQuickSaleDisplay(
  businessId: string,
  rows: JournalAction[],
  sales: readonly QuickSaleLink[],
  lines: readonly QuickSaleLineLink[],
): JournalAction[] {
  return rows.map((row) => {
    if (!isQuickSaleStockMove(row)) return row;
    const sale = one(sales.filter((item) => item.businessId === businessId && item.id === row.reference_id));
    const line = one(lines.filter((item) =>
      item.businessId === businessId
      && item.inventoryActionId === row.id
      && item.transactionId === row.reference_id));
    const amount = line && typeof line.lineRevenueGrossIls === 'number' && Number.isFinite(line.lineRevenueGrossIls)
      ? line.lineRevenueGrossIls
      : null;
    return {
      ...row,
      display_salesperson_employee_id: sale ? sale.salespersonEmployeeId : null,
      display_line_revenue_gross_ils: amount,
    };
  });
}

export const movementEmployeeId = (row: JournalAction): string | null => {
  if (isQuickSaleStockMove(row)) return row.display_salesperson_employee_id ?? null;
  return row.salesperson_employee_id;
};

/** PostgREST fragment. Ids are limited to UUIDs already loaded for one business. */
export function employeeScope(employeeId: string, quickSaleTransactionIds: readonly string[]): EmployeeScope {
  const ids = [...new Set(quickSaleTransactionIds.filter((id) => UUID.test(id)))];
  if (employeeId === 'all') return { mode: 'all' };
  if (employeeId === 'unattributed') {
    return {
      mode: 'unattributed',
      orGroup: ids.length
        ? `reference_type.is.null,reference_type.neq.sale_transaction,reference_id.is.null,reference_id.not.in.(${ids.join(',')})`
        : null,
    };
  }
  if (!UUID.test(employeeId)) return { mode: 'employee', orGroup: 'id.eq.00000000-0000-0000-0000-000000000000' };
  const quick = ids.length ? `,and(reference_type.eq.sale_transaction,reference_id.in.(${ids.join(',')}))` : '';
  return { mode: 'employee', orGroup: `salesperson_employee_id.eq.${employeeId}${quick}` };
}

/** Stored only on movements that wrote both numbers. Missing keys stay unavailable. */
export const movementBalance = (row: Pick<JournalAction, 'reference_meta'>): { before: number | null; after: number | null } => {
  const meta = row.reference_meta;
  if (!meta) return { before: null, after: null };
  const before = meta.stock_before;
  const after = meta.stock_after;
  if (typeof before !== 'number' || typeof after !== 'number' || !Number.isInteger(before) || !Number.isInteger(after)) {
    return { before: null, after: null };
  }
  return { before, after };
};

export const movementUnitPrice = (row: JournalAction): number | null => {
  if (isLegacySale(row) || isQuickSaleStockMove(row)) return row.sale_unit_ils;
  if (isPurchaseReceipt(row)) return row.purchase_unit_ils;
  return null;
};

export interface JournalMoney {
  summary: PeriodSummary;
  truncated: boolean;
  saleRows: number;
}

export const moneyFromSales = (rows: SaleRow[], truncated: boolean): JournalMoney => ({
  summary: summarize(rows),
  truncated,
  saleRows: rows.length,
});

export const toSaleRow = (row: JournalAction): SaleRow => ({
  timestamp: row.timestamp,
  product_id: row.product_id,
  quantity_changed: row.quantity_changed,
  sale_total_ils: row.sale_total_ils,
  cost_snapshot_ils: row.cost_snapshot_ils,
  cost_known: atomicLegacyCostKnown(row.reference_type, row.cost_snapshot_ils),
});
