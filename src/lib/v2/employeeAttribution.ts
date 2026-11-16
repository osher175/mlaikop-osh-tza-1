/**
 * Employee directory is prepared for an approved release. The two sales
 * flags stay false, so this file does not enable quick-sale writes or
 * legacy salesperson attribution.
 *
 * Remaining order, each after its own approval:
 * 1. Publish this directory release. Legacy sales still omit the salesperson.
 * 2. Apply docs/v2/legacy-sale-atomic.UNAPPLIED.sql. The dialog keeps the
 *    two-step write while LEGACY_SALE_ATOMIC_READY is false.
 * 3. Deploy the client that calls record_legacy_sale, then set that flag.
 *    EditProductDialog takes that branch only while the flag is true.
 *    A frontend flag without the deployed function is not an atomic sale.
 *    Attribution stays blocked while this flag is false, so a salesperson
 *    is never dropped onto execute_inventory_transaction.
 * 4. Apply docs/v2/legacy-sale-direct-write-guard.UNAPPLIED.sql. There is no
 *    service worker, so this guard is what stops a cached page from selling.
 * 5. Set LEGACY_SALE_ATTRIBUTION_READY true only after one active employee
 *    exists. New sessions then send one employee. Older tabs still omit it.
 * 6. Apply docs/v2/salesperson-required-b.enforcement.sql.
 * 7. Apply docs/v2/sale-list-price-snapshot.UNAPPLIED.sql. It replaces
 *    complete_quick_sale again. Do not re-apply B after it.
 * 8. Only then set V2_SALES_STACK_READY true.
 * Reporting SQL and the inventory lifecycle do not wait for that flag.
 * Their order is the manifest, and legacy-sale-atomic must be applied
 * before this flag because the live sale check rejects a quick-sale stock row.
 *
 * The full order, including files that must not be applied, is
 * docs/v2/PHASE10-migration-manifest.md.
 * Do not apply migration B before step 5 is what production is serving.
 * Do not apply the direct-write guard before step 3 is deployed.
 * Apply legacy-sale-atomic before enabling quick sales: the live
 * check_sale_data rule rejects a quick-sale stock row.
 */
export const V2_SALES_STACK_READY = false;

/** Owner employee management. Independent of quick-sale writes. */
export const EMPLOYEES_DIRECTORY_READY = true;

export const QUICK_SALE_PERSISTENCE_READY = V2_SALES_STACK_READY;

/**
 * Attribution is stored on sale_transactions.salesperson_employee_id.
 * Do not read inventory_actions.user_id as the salesperson.
 */
export const EMPLOYEE_SALES_ATTRIBUTION_READY = V2_SALES_STACK_READY;

/**
 * Leave false until migration A is applied and at least one active employee exists.
 * When true, SaleModal requires one employee and the insert includes
 * salesperson_employee_id. Older bundles keep the flag false and still omit it.
 */
export const LEGACY_SALE_ATTRIBUTION_READY = false;

/**
 * Reports may show a stored salesperson after either sales gate is on.
 * Both are false today, so performance stays unattributed.
 * A missing id is never treated as an employee.
 */
export const SALESPERSON_REPORT_READY = LEGACY_SALE_ATTRIBUTION_READY || EMPLOYEE_SALES_ATTRIBUTION_READY;

/**
 * Adds the employee id only after the legacy column exists.
 * Never copies inventory_actions.user_id and never invents an employee.
 */
export function attachSalesperson<T extends object>(row: T, salespersonEmployeeId?: string | null): T {
  if (!LEGACY_SALE_ATTRIBUTION_READY || !salespersonEmployeeId) return row;
  return { ...row, salesperson_employee_id: salespersonEmployeeId };
}
