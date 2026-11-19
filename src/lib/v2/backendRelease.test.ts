import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGACY_SALE_ATTRIBUTION_READY, QUICK_SALE_PERSISTENCE_READY, V2_SALES_STACK_READY } from '@/lib/v2/employeeAttribution';
import {
  CUSTOMER_RETURN_READY,
  PURCHASE_ORDERS_READY,
  PURCHASE_RECEIPT_ATOMIC_READY,
  STOCK_ADJUSTMENT_RPC_READY,
  SUPPLIER_RETURN_AUTHORITY,
  SUPPLIER_RETURN_DISPATCH_READY,
  SUPPLIER_RETURN_READY,
  SUPPLIER_RETURN_RESERVATION_READY,
} from '@/lib/v2/inventoryFlags';
import { LEGACY_SALE_ATOMIC_READY, resolveLegacySaleWrite } from '@/lib/v2/legacySaleAtomic';
import { FIFO_AGING_READY, V2_REPORTS_SQL_READY } from '@/lib/v2/reportFlags';
import { explicitPurchaseCost, planLegacyProductSave, purchaseCostFromInput, UNKNOWN_COST_SALE_MESSAGE } from '@/lib/v2/legacyInventoryWrite';
import { quoteDraft } from '@/lib/v2/saleQuote';
import { readEmployeeSalesReport } from '@/lib/v2/employeeSalesReport';
import { V2_UI_DEFAULT_ENABLED, v2DefaultSwitchReady } from '@/lib/v2/uiFlag';
import type { DraftLine } from '@/lib/v2/saleDraft';

assert.equal(V2_UI_DEFAULT_ENABLED, true);
assert.equal(v2DefaultSwitchReady({ legacySaleAtomic: false, legacyAttribution: false, quickSale: false }), false);
assert.equal(v2DefaultSwitchReady({ legacySaleAtomic: true, legacyAttribution: true, quickSale: true }), true);
assert.equal(resolveLegacySaleWrite({ atomicReady: false, attributionReady: false, salespersonEmployeeId: 'e' }).mode, 'inventory_transaction');
const blockedAttribution = resolveLegacySaleWrite({ atomicReady: false, attributionReady: true, salespersonEmployeeId: 'e' });
assert.equal(blockedAttribution.mode, 'blocked');
const blockedMissing = resolveLegacySaleWrite({ atomicReady: true, attributionReady: true, salespersonEmployeeId: null });
assert.equal(blockedMissing.mode, 'blocked');
assert.deepEqual(resolveLegacySaleWrite({ atomicReady: true, attributionReady: true, salespersonEmployeeId: 'e' }), { mode: 'atomic', salespersonEmployeeId: 'e' });
assert.deepEqual(resolveLegacySaleWrite({ atomicReady: true, attributionReady: false, salespersonEmployeeId: 'e' }), { mode: 'atomic', salespersonEmployeeId: null });
assert.equal(V2_SALES_STACK_READY, true);
assert.equal(QUICK_SALE_PERSISTENCE_READY, true);
assert.equal(LEGACY_SALE_ATTRIBUTION_READY, true);
assert.equal(LEGACY_SALE_ATOMIC_READY, true);
assert.equal(PURCHASE_ORDERS_READY, true);
assert.equal(PURCHASE_RECEIPT_ATOMIC_READY, true);
assert.equal(STOCK_ADJUSTMENT_RPC_READY, true);
assert.equal(SUPPLIER_RETURN_READY, false);
assert.equal(SUPPLIER_RETURN_RESERVATION_READY, false);
assert.equal(SUPPLIER_RETURN_AUTHORITY, 'confirm_supplier_return_dispatch');
const historyReport = readEmployeeSalesReport({
  revenue_gross: 118,
  gross_profit: null,
  vat: 18,
  unknown_cost_revenue: 118,
  units: 1,
  transactions: 1,
  customer_return_units: 0,
  unattributed: { revenue_gross: 118, gross_profit: null, units: 1, transactions: 1, unknown_cost_revenue: 118 },
  employees: [],
});
assert.equal(historyReport?.unattributed.grossProfit, null);
assert.equal(historyReport?.unattributed.revenueGross, 118);
assert.equal(readEmployeeSalesReport({ revenue_gross: 1, gross_profit: 0, vat: 0, unknown_cost_revenue: 0, units: 1, transactions: 1, customer_return_units: 0, employees: [] }), null);
assert.equal(SUPPLIER_RETURN_DISPATCH_READY, true);
assert.equal(CUSTOMER_RETURN_READY, true);
assert.equal(V2_REPORTS_SQL_READY, true);
assert.equal(FIFO_AGING_READY, false);

const line = (unitCost: number | null): DraftLine => ({
  key: 'k',
  productId: 'p',
  name: 'צמיג',
  barcode: null,
  quantity: 2,
  available: 4,
  unitPriceGross: 100,
  listUnitGross: 120,
  unitCost,
  axle: 'single',
});

assert.equal(purchaseCostFromInput(''), null);
assert.equal(purchaseCostFromInput('0'), 0);
assert.equal(purchaseCostFromInput('12.5'), 12.5);
assert.equal(explicitPurchaseCost(null, 80), 80);
assert.equal(explicitPurchaseCost(0, 80), 0);
assert.equal(explicitPurchaseCost(null, null), null);
const blockedSale = planLegacyProductSave({
  businessId: 'b', productId: 'p', oldQuantity: 4, newQuantity: 3,
  listUnitIls: 100, costSnapshotIls: null,
  sale: { saleTotalIls: 100 }, purchase: null,
});
assert.equal(blockedSale.error, UNKNOWN_COST_SALE_MESSAGE);
assert.equal(blockedSale.stock, null);
const zeroCostSale = planLegacyProductSave({
  businessId: 'b', productId: 'p', oldQuantity: 4, newQuantity: 3,
  listUnitIls: 100, costSnapshotIls: 0,
  sale: { saleTotalIls: 100 }, purchase: null,
});
assert.equal(zeroCostSale.error, null);
assert.equal(zeroCostSale.stock?.costSnapshotIls, 0);

assert.equal(quoteDraft([line(80), line(0)]).costComplete, true);
assert.equal(quoteDraft([line(null)]).costComplete, false);
assert.equal(quoteDraft([line(null)]).knownProfit, null);

const sale = readFileSync('src/lib/v2/quickSaleWrite.ts', 'utf8');
const costStop = sale.indexOf('quoteDraft(draft.lines).costComplete');
const rpc = sale.indexOf("supabase.rpc('complete_quick_sale'");
assert.equal(costStop > sale.indexOf('QUICK_SALE_PERSISTENCE_READY'), true);
assert.equal(costStop < rpc, true);

const lifecycle = readFileSync('src/lib/v2/inventoryLifecycle.ts', 'utf8');
const reserveFlag = lifecycle.indexOf('if (!SUPPLIER_RETURN_RESERVATION_READY) reservationClosed();');
const reserveRpc = lifecycle.indexOf("supabase.rpc('reserve_supplier_return'");
const releaseRpc = lifecycle.indexOf("supabase.rpc('release_supplier_return_reservation'");
const dispatchFlag = lifecycle.indexOf('if (!SUPPLIER_RETURN_DISPATCH_READY)');
const dispatchRpc = lifecycle.indexOf("supabase.rpc('dispatch_reserved_supplier_return'");
assert.equal(reserveFlag > -1 && reserveFlag < reserveRpc, true);
assert.equal(reserveFlag < releaseRpc, true);
assert.equal(dispatchFlag > -1 && dispatchFlag < dispatchRpc, true);

const reservationSql = readFileSync('docs/v2/supplier-return-reservation.UNAPPLIED.sql', 'utf8');
assert.match(reservationSql, /quantity_reserved = quantity_reserved \+ v_quantity/);
assert.match(reservationSql, /quantity = quantity - v_line\.quantity/);
assert.match(reservationSql, /quantity_reserved = quantity_reserved - v_line\.quantity/);
assert.equal(reservationSql.includes('SET quantity = quantity -') && reservationSql.includes('reserve_supplier_return'), true);
assert.equal(reservationSql.indexOf('SET quantity = quantity -'), reservationSql.lastIndexOf('SET quantity = quantity -'));
assert.match(reservationSql, /apply the production quantity lock before supplier return reservation/);

const productionLock = readFileSync('docs/v2/products-quantity-update-lock.PRODUCTION.UNAPPLIED.sql', 'utf8');
assert.match(productionLock, /mlaiko\.apply_quantity_lock/);
assert.match(productionLock, /gtakgctmtayalcbpnryg/);
assert.match(productionLock, /isolated project refused/);
assert.match(productionLock, /a\.attname <> 'quantity_reserved'/);
assert.match(productionLock, /post_purchase_receipt product insert is not literal quantity 0/);
assert.match(productionLock, /p\.proname <> 'post_purchase_receipt'/);
const salespersonEnforcement = readFileSync('docs/v2/salesperson-required-b.enforcement.sql', 'utf8');
assert.match(salespersonEnforcement, /salesperson is required/);
assert.match(salespersonEnforcement, /complete_quick_sale stays as deployed/);
assert.equal(salespersonEnforcement.includes('CREATE OR REPLACE FUNCTION public.complete_quick_sale'), false);
assert.equal(salespersonEnforcement.includes('UPDATE public.sale_transactions SET salesperson_employee_id'), false);
assert.equal(productionLock.includes("IS DISTINCT FROM 'zijzwvkpjaxvdbvpcfow'"), false);

const isolatedLock = readFileSync('docs/v2/products-quantity-update-lock.UNAPPLIED.sql', 'utf8');
assert.match(isolatedLock, /production ref refused/);

const bi = readFileSync('docs/v2/bi-insights-known-cost.UNAPPLIED.sql', 'utf8');
assert.equal(bi.charCodeAt(0) === 0xfeff, false);
const costFix = readFileSync('docs/v2/preserve-unknown-cost.UNAPPLIED.sql', 'utf8');
assert.match(costFix, /SELECT quantity, cost/);
assert.match(costFix, /v_current_cost IS NULL AND v_current_quantity > 0/);
assert.match(costFix, /known cost is required/);
assert.equal(costFix.includes('SELECT quantity, COALESCE(cost, 0)'), false);
const importFix = readFileSync('docs/v2/import-receipt-shortage-event.UNAPPLIED.sql', 'utf8');
assert.match(importFix, /receipt_shortage_recorded/);
assert.match(importFix, /receipt_overage_recorded/);
assert.match(importFix, /does not replace import_receipt_confirm/);
const reversalFix = readFileSync('docs/v2/return-after-customer-return.UNAPPLIED.sql', 'utf8');
assert.match(reversalFix, /reversal is closed after a customer return/);
assert.equal(reversalFix.includes('CREATE OR REPLACE FUNCTION public.reverse_inventory_action'), false);
const editor = readFileSync('src/components/inventory/EditProductDialog.tsx', 'utf8');
const saleRoute = editor.indexOf('resolveLegacySaleWrite({');
const atomicSale = editor.indexOf('await recordLegacySaleAtomic');
const inventorySale = editor.indexOf("supabase.rpc('execute_inventory_transaction'");
assert.equal(saleRoute > -1 && saleRoute < atomicSale && atomicSale < inventorySale, true);
const adjustment = editor.indexOf("stock.actionType === 'adjust' && STOCK_ADJUSTMENT_RPC_READY");
assert.equal(adjustment > atomicSale && adjustment < inventorySale, true);
assert.match(editor, /salespersonEmployeeId: route\.salespersonEmployeeId/);
assert.equal(editor.includes('quantity: formData.quantity') || editor.includes('quantity: newQuantity'), false);
const employeeReport = readFileSync('docs/v2/employee-sales-report.UNAPPLIED.sql', 'utf8');
assert.match(employeeReport, /unit_cost IS NULL THEN NULL/);
assert.match(employeeReport, /customer_return/);
assert.match(employeeReport, /t.status = 'completed'/);
const historySql = readFileSync('docs/v2/employee-sales-report-history.UNAPPLIED.sql', 'utf8');
assert.match(historySql, /editor_operation/);
assert.match(historySql, /'unattributed'/);
assert.equal(historySql.includes('ia.user_id'), false);
const reportClient = readFileSync('src/lib/v2/employeeSalesReport.ts', 'utf8');
assert.equal(reportClient.indexOf('if (!V2_REPORTS_SQL_READY)') < reportClient.indexOf("rpc('employee_sales_report'"), true);
const receiptGrant = readFileSync('docs/v2/purchase-receipt-grant.UNAPPLIED.sql', 'utf8');
assert.match(receiptGrant, /GRANT EXECUTE ON FUNCTION public.post_purchase_receipt/);
assert.equal(receiptGrant.includes('CREATE OR REPLACE FUNCTION public.post_purchase_receipt'), false);
const receiptWrite = readFileSync('src/lib/v2/purchaseReceiptWrite.ts', 'utf8');
assert.equal(receiptWrite.indexOf('if (!receiptPostingAvailable())') < receiptWrite.indexOf("rpc('post_purchase_receipt'"), true);
const knownCost = readFileSync('docs/v2/sale-known-cost-required.UNAPPLIED.sql', 'utf8');
assert.match(knownCost, /NEW\.unit_cost_ils IS NULL/);
assert.match(knownCost, /BEFORE INSERT ON public\.sale_lines/);

for (const file of [
  'docs/v2/supplier-return-reservation.UNAPPLIED.sql',
  'docs/v2/sale-known-cost-required.UNAPPLIED.sql',
  'docs/v2/products-quantity-update-lock.PRODUCTION.UNAPPLIED.sql',
]) {
  assert.equal(file.startsWith('supabase/migrations'), false);
}

console.log('backend release assertions passed');
