import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isLegacySale, moneyFromSales, toSaleRow } from '@/lib/v2/movementJournal';
import {
  attachQuickSaleDisplay,
  employeeScope,
  movementBalance,
  movementEmployeeId,
  movementTotal,
  type JournalAction,
  type QuickSaleLineLink,
  type QuickSaleLink,
} from '@/lib/v2/movementJournal';

const business = '11111111-1111-4111-8111-111111111111';
const otherBusiness = '22222222-2222-4222-8222-222222222222';
const employee = '33333333-3333-4333-8333-333333333333';
const transaction = '55555555-5555-4555-8555-555555555555';
const firstAction = '66666666-6666-4666-8666-666666666666';
const secondAction = '77777777-7777-4777-8777-777777777777';

const movement = (patch: Partial<JournalAction>): JournalAction => ({
  id: firstAction,
  timestamp: '2026-11-18T10:00:00.000Z',
  action_type: 'sale',
  product_id: 'product-a',
  quantity_changed: -2,
  sale_unit_ils: 50,
  sale_total_ils: null,
  purchase_unit_ils: null,
  purchase_total_ils: null,
  cost_snapshot_ils: 20,
  supplier_id: null,
  salesperson_employee_id: null,
  reference_id: transaction,
  reference_type: 'sale_transaction',
  notes: null,
  is_reversal: false,
  reversed_at: null,
  reverses_action_id: null,
  source: 'sale_transaction',
  user_id: 'signed-in-user',
  reference_meta: null,
  ...patch,
});

const sale = (patch: Partial<QuickSaleLink> = {}): QuickSaleLink => ({
  id: transaction,
  businessId: business,
  salespersonEmployeeId: employee,
  ...patch,
});

const line = (patch: Partial<QuickSaleLineLink> = {}): QuickSaleLineLink => ({
  inventoryActionId: firstAction,
  transactionId: transaction,
  businessId: business,
  lineRevenueGrossIls: 100,
  ...patch,
});

const quick = attachQuickSaleDisplay(business, [movement({})], [sale()], [line()])[0];
assert.equal(movementEmployeeId(quick), employee);
assert.equal(movementTotal(quick), 100);
assert.equal(quick.sale_total_ils, null);
assert.equal(quick.salesperson_employee_id, null);
assert.equal(isLegacySale(quick), false);
assert.equal(toSaleRow(quick).sale_total_ils, null);
assert.equal(moneyFromSales([toSaleRow(quick)], false).summary.revenueGross, 0);

const selected = employeeScope(employee, [transaction]);
assert.equal(selected.mode, 'employee');
if (selected.mode === 'employee') {
  assert.match(selected.orGroup, new RegExp(`salesperson_employee_id\\.eq\\.${employee}`));
  assert.match(selected.orGroup, new RegExp(`reference_id\\.in\\.\\(${transaction}\\)`));
}
const unassigned = employeeScope('unattributed', [transaction]);
assert.equal(unassigned.mode, 'unattributed');
if (unassigned.mode === 'unattributed') assert.match(unassigned.orGroup ?? '', new RegExp(`reference_id\\.not\\.in\\.\\(${transaction}\\)`));
assert.equal(movementEmployeeId(attachQuickSaleDisplay(business, [movement({})], [], [])[0]), null);
assert.deepEqual(employeeScope('all', [transaction]), { mode: 'all' });

const legacy = movement({
  reference_type: null,
  reference_id: null,
  sale_total_ils: 118,
  salesperson_employee_id: employee,
});
assert.equal(movementTotal(attachQuickSaleDisplay(business, [legacy], [sale()], [line()])[0]), 118);
assert.equal(movementEmployeeId(legacy), employee);

const historical = movement({
  reference_type: null,
  reference_id: null,
  sale_total_ils: 80,
  salesperson_employee_id: null,
});
assert.equal(movementEmployeeId(historical), null);
assert.equal(movementTotal(historical), 80);

const pair = attachQuickSaleDisplay(business, [
  movement({ id: firstAction, product_id: 'product-a' }),
  movement({ id: secondAction, product_id: 'product-b', quantity_changed: -1 }),
], [sale()], [
  line({ inventoryActionId: firstAction, lineRevenueGrossIls: 100 }),
  line({ inventoryActionId: secondAction, lineRevenueGrossIls: 40 }),
]);
assert.deepEqual(pair.map(movementTotal), [100, 40]);
assert.deepEqual(pair.map(movementEmployeeId), [employee, employee]);

assert.equal(movementTotal(attachQuickSaleDisplay(business, [movement({})], [sale()], [])[0]), null);
assert.equal(movementTotal(attachQuickSaleDisplay(business, [movement({})], [sale()], [
  line({ lineRevenueGrossIls: 100 }),
  line({ lineRevenueGrossIls: 40 }),
])[0]), null);
assert.equal(movementTotal(attachQuickSaleDisplay(business, [movement({})], [sale()], [
  line({ transactionId: '88888888-8888-4888-8888-888888888888', lineRevenueGrossIls: 100 }),
])[0]), null);

const receipt = movement({
  id: '99999999-9999-4999-8999-999999999999',
  action_type: 'purchase',
  reference_type: 'purchase_receipt',
  reference_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sale_total_ils: null,
  sale_unit_ils: null,
  purchase_total_ils: 640,
  purchase_unit_ils: 20,
  quantity_changed: 32,
  reference_meta: { stock_before: 0, stock_after: 32 },
});
assert.deepEqual(movementBalance(receipt), { before: 0, after: 32 });
assert.equal(movementTotal(receipt), 640);
assert.deepEqual(movementBalance(quick), { before: null, after: null });

const foreign = attachQuickSaleDisplay(business, [movement({})], [sale({ businessId: otherBusiness })], [line({ businessId: otherBusiness })])[0];
assert.equal(movementEmployeeId(foreign), null);
assert.equal(movementTotal(foreign), null);

const hook = readFileSync('src/hooks/v2/useMovementJournal.ts', 'utf8');
assert.match(hook, /sale_transactions'\)\.select\('id'\)\.eq\('business_id', businessId\)/);
assert.match(hook, /sale_transactions'\)\.select\('id, business_id, salesperson_employee_id'\)\.eq\('business_id', businessId\)/);
assert.match(hook, /sale_lines'\)\.select\('inventory_action_id, transaction_id, business_id, line_revenue_gross_ils'\)\.eq\('business_id', businessId\)/);
assert.match(hook, /batch\.filter\(isLegacySale\)/);
assert.match(hook, /loadQuickSaleFacts/);
assert.equal(hook.includes('.update('), false);
assert.equal(hook.includes('.insert('), false);
assert.equal(hook.includes('sale_total_ils:'), false);

const screen = readFileSync('src/components/v2/movements/MovementsV2.tsx', 'utf8');
assert.match(screen, /movementEmployeeId\(row\)/);
assert.match(screen, /balance\.before === null \? 'לא זמין'/);
assert.match(screen, /movementTotal\(row\) === null \? 'לא ידוע'/);

console.log('quick sale movement assertions passed');
