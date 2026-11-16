import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  atomicLegacyCostKnown,
  employeeAnalytics,
  summarize,
  type AttributedSaleRow,
} from '@/lib/v2/dashboardMetrics';
import {
  CUSTOMER_RETURN_READY,
  PURCHASE_RECEIPT_ATOMIC_READY,
  STOCK_ADJUSTMENT_RPC_READY,
  SUPPLIER_RETURN_READY,
} from '@/lib/v2/inventoryFlags';
import {
  EMPLOYEES_DIRECTORY_READY,
  EMPLOYEE_SALES_ATTRIBUTION_READY,
  LEGACY_SALE_ATTRIBUTION_READY,
  QUICK_SALE_PERSISTENCE_READY,
  SALESPERSON_REPORT_READY,
  V2_SALES_STACK_READY,
} from '@/lib/v2/employeeAttribution';
import {
  foreignRateMissing,
  nonPaidImportIls,
  orderPayableRemaining,
  paidImportIls,
} from '@/lib/v2/importPaymentMath';
import {
  classifyJournal,
  knownUnitCost,
  moneyFromSales,
  movementBalance,
  movementTotal,
  type JournalAction,
} from '@/lib/v2/movementJournal';
import {
  partialReturnQuantityValid,
  purchaseReceiptQuantityValid,
  supplierReturnQuantityValid,
} from '@/lib/v2/quantityRules';
import { fullReversalClosed } from '@/lib/v2/reversalRules';
import { catalogListAccepted, employeeDiscountReport, knownStoredDiscount, snapshotSaleDiscount } from '@/lib/v2/saleDiscount';

const sale = (patch: Partial<AttributedSaleRow>): AttributedSaleRow => ({
  timestamp: '2026-11-11T10:00:00.000Z',
  product_id: 'p',
  quantity_changed: -2,
  sale_total_ils: 118,
  cost_snapshot_ils: 40,
  salesperson_employee_id: null,
  ...patch,
});

const action = (patch: Partial<JournalAction>): JournalAction => ({
  id: 'a',
  timestamp: '2026-11-11T10:00:00.000Z',
  action_type: 'sale',
  product_id: 'p',
  quantity_changed: -2,
  sale_unit_ils: 59,
  sale_total_ils: 118,
  purchase_unit_ils: null,
  purchase_total_ils: null,
  cost_snapshot_ils: 40,
  supplier_id: null,
  salesperson_employee_id: null,
  reference_id: null,
  reference_type: null,
  notes: null,
  is_reversal: false,
  reversed_at: null,
  reverses_action_id: null,
  source: null,
  user_id: 'signed-in-user',
  reference_meta: null,
  ...patch,
});

const vatProfit = summarize([sale({})]);
assert.equal(vatProfit.revenueGross, 118);
assert.equal(Math.round(vatProfit.grossProfit! * 100) / 100, 20);

const historicalZero = summarize([sale({ cost_snapshot_ils: 0 })]);
assert.equal(historicalZero.revenueGross, 118);
assert.equal(historicalZero.grossProfit, null);

const genuineZero = summarize([sale({ cost_snapshot_ils: 0, cost_known: true })]);
assert.equal(Math.round(genuineZero.grossProfit! * 100) / 100, 100);

const unknownAtomic = summarize([sale({
  cost_snapshot_ils: null,
  cost_known: atomicLegacyCostKnown('legacy_sale_request', null),
})]);
assert.equal(unknownAtomic.grossProfit, null);
assert.equal(atomicLegacyCostKnown('legacy_sale_request', 0), true);
assert.equal(knownUnitCost({ cost_snapshot_ils: 0, reference_type: 'legacy_sale_request' }), 0);
assert.equal(knownUnitCost({ cost_snapshot_ils: 0, reference_type: null }), null);

const lines = employeeAnalytics([
  sale({ sale_total_ils: 118, quantity_changed: -1, transaction_id: 'txn-1', salesperson_employee_id: 'e1', product_id: 'p1' }),
  sale({ sale_total_ils: 59, quantity_changed: -1, cost_snapshot_ils: 20, transaction_id: 'txn-1', salesperson_employee_id: 'e1', product_id: 'p2' }),
]);
assert.equal(lines.ranked[0].transactions, 1);
assert.equal(lines.ranked[0].revenueGross, 177);
assert.equal(lines.reconciles, true);

const stockOnly = summarize([sale({ sale_total_ils: null, reference_type: 'sale_transaction' } as Partial<AttributedSaleRow>)]);
assert.equal(stockOnly.revenueGross, 0);
assert.equal(stockOnly.rowsWithoutRevenue, 1);

const unattributed = employeeAnalytics([sale({ salesperson_employee_id: null })]);
assert.equal(unattributed.attributedRevenue, 0);
assert.equal(unattributed.unattributedRevenue, 118);
assert.equal(unattributed.ranked.length, 0);

assert.equal(classifyJournal(action({ is_reversal: true })), 'reversal');
assert.equal(classifyJournal(action({ reference_type: 'supplier_return', sale_total_ils: null, action_type: 'return', quantity_changed: -1 })), 'supplier_return');
assert.equal(movementTotal(action({ reference_type: 'supplier_return', sale_total_ils: null, action_type: 'return' })), null);
assert.equal(classifyJournal(action({ reference_type: 'customer_return', sale_total_ils: null, action_type: 'return', quantity_changed: 1 })), 'customer_return');
assert.equal(classifyJournal(action({ action_type: 'purchase', sale_total_ils: null, purchase_total_ils: 80, quantity_changed: 4 })), 'purchase');
assert.equal(classifyJournal(action({ action_type: 'adjust', sale_total_ils: null, quantity_changed: -1 })), 'adjustment');
assert.equal(classifyJournal(action({ reference_type: 'sale_transaction', sale_total_ils: null })), 'sale');
assert.equal(classifyJournal(action({ reversed_at: '2026-11-11T10:05:00.000Z' })), 'other');

assert.equal(fullReversalClosed(true), true);
assert.equal(fullReversalClosed(false), false);
assert.deepEqual(movementBalance({ reference_meta: { stock_before: 10, stock_after: 8 } }), { before: 10, after: 8 });
assert.deepEqual(movementBalance({ reference_meta: null }), { before: null, after: null });
assert.equal(moneyFromSales([sale({})], true).truncated, true);

assert.equal(partialReturnQuantityValid(1, 2), true);
assert.equal(partialReturnQuantityValid(3, 2), false);
assert.equal(partialReturnQuantityValid(1.5, 2), false);
assert.equal(supplierReturnQuantityValid(0), false);
assert.equal(purchaseReceiptQuantityValid(4), true);
assert.equal(purchaseReceiptQuantityValid(0), false);

const payments = [
  { payment_status: 'paid', amount_ils: 40 },
  { payment_status: 'paid', amount_ils: 60 },
  { payment_status: 'planned', amount_ils: 25 },
  { payment_status: 'cancelled', amount_ils: 10 },
];
assert.equal(paidImportIls(payments), 100);
assert.equal(nonPaidImportIls(payments), 35);
assert.equal(orderPayableRemaining(200, 50, paidImportIls(payments)), 150);
assert.equal(foreignRateMissing('USD', ''), true);
assert.equal(foreignRateMissing('ILS', ''), false);

assert.equal(snapshotSaleDiscount(null, 100, 2).discountIls, null);
assert.equal(snapshotSaleDiscount(80, 160, 2).discountIls, 0);
assert.equal(snapshotSaleDiscount(80, 100, 2).discountIls, 60);
const historicalCoerced = knownStoredDiscount({
  referenceType: null, listUnitIls: 0, discountIls: 0, discountPercent: 0,
  salespersonEmployeeId: 'e', transactionId: 't', productId: 'p', quantity: -1, saleTotalIls: 100,
});
assert.equal(historicalCoerced, null);
const recorded = knownStoredDiscount({
  referenceType: 'legacy_sale_request', listUnitIls: 80, discountIls: 20, discountPercent: 12.5,
  salespersonEmployeeId: 'e', transactionId: 't', productId: 'p', quantity: -2, saleTotalIls: 140,
});
assert.equal(recorded?.amount, 20);
assert.equal(catalogListAccepted(200, 80), false);
assert.equal(catalogListAccepted(80, 80), true);
assert.equal(catalogListAccepted(null, null), true);
const shapes = employeeDiscountReport([
  { referenceType: 'legacy_sale_request', listUnitIls: 100, discountIls: 0, discountPercent: 0, salespersonEmployeeId: 'e', transactionId: 'pair', productId: 'p', quantity: -2, saleTotalIls: 200 },
  { referenceType: 'legacy_sale_request', listUnitIls: 100, discountIls: 40, discountPercent: 10, salespersonEmployeeId: 'e', transactionId: 'set', productId: 'p', quantity: -4, saleTotalIls: 360 },
  { referenceType: 'legacy_sale_request', listUnitIls: 100, discountIls: 10, discountPercent: 10, salespersonEmployeeId: 'e', transactionId: 'mixed', productId: 'p', quantity: -1, saleTotalIls: 90 },
  { referenceType: 'legacy_sale_request', listUnitIls: null, discountIls: null, discountPercent: null, salespersonEmployeeId: 'e', transactionId: 'mixed', productId: 'q', quantity: -1, saleTotalIls: 50 },
]);
assert.equal(shapes.shapes.pair, 1);
assert.equal(shapes.shapes.set, 1);
assert.equal(shapes.shapes.mixed, 0);
assert.equal(shapes.fullPriceSales, 1);
assert.equal(shapes.discountedSales, 1);
assert.equal(shapes.unknownRows, 1);
const mixedProducts = employeeDiscountReport([
  { referenceType: 'legacy_sale_request', listUnitIls: 100, discountIls: 0, discountPercent: 0, salespersonEmployeeId: 'e', transactionId: 'two', productId: 'a', quantity: -2, saleTotalIls: 200 },
  { referenceType: 'legacy_sale_request', listUnitIls: 100, discountIls: 0, discountPercent: 0, salespersonEmployeeId: 'e', transactionId: 'two', productId: 'b', quantity: -2, saleTotalIls: 200 },
]);
assert.equal(mixedProducts.shapes.mixed, 1);
assert.equal(mixedProducts.shapes.set, 0);

assert.equal(EMPLOYEES_DIRECTORY_READY, true);
assert.equal(V2_SALES_STACK_READY, false);
assert.equal(QUICK_SALE_PERSISTENCE_READY, false);
assert.equal(EMPLOYEE_SALES_ATTRIBUTION_READY, false);
assert.equal(LEGACY_SALE_ATTRIBUTION_READY, false);
assert.equal(SALESPERSON_REPORT_READY, false);
assert.match(readFileSync('src/lib/v2/legacySaleAtomic.ts', 'utf8'), /export const LEGACY_SALE_ATOMIC_READY = false/);
assert.equal(PURCHASE_RECEIPT_ATOMIC_READY, false);
assert.equal(STOCK_ADJUSTMENT_RPC_READY, false);
assert.equal(SUPPLIER_RETURN_READY, false);
assert.equal(CUSTOMER_RETURN_READY, false);

const screens = [
  'src/components/v2/inventory/InventoryV2.tsx',
  'src/components/v2/sale/QuickSaleV2.tsx',
  'src/components/v2/employees/EmployeesV2.tsx',
  'src/components/v2/movements/MovementsV2.tsx',
  'src/components/v2/dashboard/DashboardV2.tsx',
  'src/components/import/wizard/StepCosts.tsx',
];
for (const file of screens) {
  const source = readFileSync(file, 'utf8');
  assert.equal(source.includes('dir="rtl"'), true, file);
}
const quickSale = readFileSync('src/components/v2/sale/QuickSaleV2.tsx', 'utf8');
assert.match(quickSale, /disabled=\{!QUICK_SALE_PERSISTENCE_READY/);
assert.match(quickSale, /הטיוטה לא נרשמת ולא מורידה מלאי/);
assert.match(quickSale, /ביטול העסקה האחרונה/);
assert.match(quickSale, /ביטול מכירה מהירה כבוי/);
const journal = readFileSync('src/components/v2/movements/MovementsV2.tsx', 'utf8');
assert.match(journal, /החזרת הלקוח עדיין כבויה/);
assert.match(journal, /החזרה לספק עדיין כבויה/);
assert.equal(journal.includes('reverseQuickSale'), false);
const dialog = readFileSync('src/components/inventory/EditProductDialog.tsx', 'utf8');
assert.match(dialog, /המכירה נרשמה/);
assert.match(dialog, /פרטי המוצר לא נשמרו/);
assert.equal(readFileSync('src/components/v2/sale/QuickSaleV2.tsx', 'utf8').includes('supabase.rpc'), false);

console.log('phase11c assertions passed');
