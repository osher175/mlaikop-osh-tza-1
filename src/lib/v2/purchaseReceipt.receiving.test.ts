import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canReceive, receivablePurchaseOrders, type OrderStatus } from '@/lib/v2/purchaseOrder';
import { explainPurchaseReceiptError, receiptErrorText } from '@/lib/v2/purchaseReceiptWrite';

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
assert.equal(screen.includes(".from('products')"), false);
assert.equal(screen.includes('products.quantity'), false);

const sql = readFileSync('docs/v2/inventory-lots-receipt.UNAPPLIED.sql', 'utf8');
assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.inventory_lots/);
assert.match(sql, /source_type IN \([\s\S]*'purchase_receipt'/);
assert.equal(sql.includes('CREATE OR REPLACE FUNCTION public.post_purchase_receipt'), false);
assert.equal(sql.includes('GRANT EXECUTE'), false);
assert.equal(sql.includes('UPDATE public.products'), false);
assert.equal(sql.includes('purchase_orders'), false);
assert.equal(sql.startsWith('-- UNAPPLIED'), true);

console.log('purchase receipt receiving assertions passed');
