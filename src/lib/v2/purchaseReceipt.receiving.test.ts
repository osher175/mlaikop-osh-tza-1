import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canReceive, receivablePurchaseOrders, type OrderStatus } from '@/lib/v2/purchaseOrder';
import { buildPurchaseReceiptLines, explainPurchaseReceiptError, receiptAttemptSignature, receiptErrorText } from '@/lib/v2/purchaseReceiptWrite';

const orders: Array<{ id: string; status: OrderStatus }> = [
  { id: 'draft', status: 'draft' },
  { id: 'po-1', status: 'awaiting_receipt' },
  { id: 'partial', status: 'partially_received' },
  { id: 'done', status: 'completed' },
  { id: 'cancelled', status: 'cancelled' },
];

assert.deepEqual(receivablePurchaseOrders(orders).map((order) => order.id), ['po-1', 'partial']);
assert.equal(canReceive('draft'), false);
assert.equal(canReceive('completed'), false);
assert.equal(canReceive('cancelled'), false);

const plain = { message: 'relation "public.inventory_lots" does not exist', code: '42P01' };
assert.equal(receiptErrorText(plain), plain.message);
const hidden = explainPurchaseReceiptError(receiptErrorText(plain));
assert.equal(hidden, 'קליטת המלאי אינה מוכנה במערכת. המלאי לא השתנה.');
assert.equal(hidden.includes('inventory_lots'), false);
assert.equal(hidden.includes('42P01'), false);

assert.equal(
  explainPurchaseReceiptError('quantity exceeds the open balance'),
  'אי אפשר לקלוט יותר מהיתרה הפתוחה. המלאי לא השתנה.',
);
assert.equal(
  explainPurchaseReceiptError('permission denied for function post_purchase_receipt'),
  'אין הרשאה לקלוט את ההזמנה הזו. המלאי לא השתנה.',
);
assert.equal(explainPurchaseReceiptError('database exploded').includes('database exploded'), false);
assert.equal(
  explainPurchaseReceiptError('הקליטה לא הושלמה. המלאי לא השתנה.'),
  'הקליטה לא הושלמה. המלאי לא השתנה.',
);

const screen = readFileSync('src/components/v2/procurement/GoodsReceivingV2.tsx', 'utf8');
const ordersScreen = readFileSync('src/components/v2/procurement/PurchaseOrdersV2.tsx', 'utf8');
assert.match(screen, /receivablePurchaseOrders\(ledger\.orders\)/);
assert.match(ordersScreen, /to="\/procurement\/receiving"/);
assert.match(ordersScreen, /to=\{`\/procurement\/receiving\?order=\$\{order\.id\}`\}/);
assert.match(screen, /product_id/);
assert.match(screen, /receiptAttemptSignature/);
assert.match(screen, /\.from\('products'\)\.select\('id, name, barcode'\)/);
assert.equal(screen.includes('matchProduct'), false);
assert.equal(screen.includes('products.quantity'), false);
assert.equal(screen.includes(".select('id, name, barcode, cost"), false);

const line = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const existing = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const stored = '33333333-3333-4333-8333-333333333333';
const base = {
  orderId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  employeeId: '44444444-4444-4444-8444-444444444444',
  updateCurrentCost: false,
  lines: [{ lineId: line, quantity: 2, agreedUnitCost: 10, storedProductId: null, choice: existing }],
};
assert.deepEqual(buildPurchaseReceiptLines(base.lines), [{
  line_id: line, quantity: 2, actual_unit_cost: 10, cost_ack: false, product_id: existing,
}]);
assert.deepEqual(buildPurchaseReceiptLines([{ ...base.lines[0], choice: 'create' }]), [{
  line_id: line, quantity: 2, actual_unit_cost: 10, cost_ack: false, create_product: true,
}]);
assert.equal(
  buildPurchaseReceiptLines([{ ...base.lines[0], storedProductId: stored, choice: 'create' }])[0].product_id,
  undefined,
);
assert.equal(
  'create_product' in buildPurchaseReceiptLines([{ ...base.lines[0], storedProductId: stored, choice: other }])[0],
  false,
);
assert.throws(() => buildPurchaseReceiptLines([{ ...base.lines[0], choice: null }]), /אינה מקושרת/);
assert.throws(() => buildPurchaseReceiptLines([{ ...base.lines[0], choice: 'Michelin' }]), /מזהה המוצר אינו תקין/);
assert.notEqual(
  receiptAttemptSignature(base),
  receiptAttemptSignature({ ...base, lines: [{ ...base.lines[0], choice: other }] }),
);
assert.notEqual(
  receiptAttemptSignature(base),
  receiptAttemptSignature({ ...base, lines: [{ ...base.lines[0], choice: 'create' }] }),
);
assert.equal(
  receiptAttemptSignature({ ...base, lines: [{ ...base.lines[0], storedProductId: stored, choice: existing }] }),
  receiptAttemptSignature({ ...base, lines: [{ ...base.lines[0], storedProductId: stored, choice: 'create' }] }),
);
assert.equal(buildPurchaseReceiptLines([{ ...base.lines[0], quantity: 0 }, { ...base.lines[0], lineId: other, choice: 'create', quantity: 1 }]).length, 1);

const sql = readFileSync('docs/v2/inventory-lots-receipt.UNAPPLIED.sql', 'utf8');
assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.inventory_lots/);
assert.match(sql, /source_type IN \([\s\S]*'purchase_receipt'/);
assert.equal(sql.includes('CREATE OR REPLACE FUNCTION public.post_purchase_receipt'), false);
assert.equal(sql.includes('GRANT EXECUTE'), false);
assert.equal(sql.includes('UPDATE public.products'), false);
assert.equal(sql.includes('purchase_orders'), false);
assert.equal(sql.startsWith('-- UNAPPLIED'), true);

console.log('purchase receipt receiving assertions passed');
