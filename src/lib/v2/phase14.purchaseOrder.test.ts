import assert from 'node:assert/strict';
import { PURCHASE_ORDERS_READY, PURCHASE_RECEIPT_ATOMIC_READY } from '@/lib/v2/inventoryFlags';
import {
  canCloseOpenBalance, canReceive, cancelOrder, closeUnfulfilled, confirmOrder, confirmProblems, costChange,
  filterOrders, matchByBarcode, matchProduct, orderNumber, orderTotals, ordersWritable, postReceipt, receiptSteps,
  receiveQuantities, statusAfterReceipt, supplierSkuConflict, transitionAllowed, type ListedOrder, type OrderLine, type PurchaseOrder,
} from '@/lib/v2/purchaseOrder';

assert.equal(PURCHASE_ORDERS_READY, false);
assert.equal(PURCHASE_RECEIPT_ATOMIC_READY, false);
assert.equal(ordersWritable(), false);

const spec = {
  key: '1', productId: null, brand: 'Michelin', model: 'Primacy 4', sizeLabel: '205/55R16',
  loadIndex: '91', speedRating: 'V', quantity: 40, unitCost: 360, supplierSku: null,
};
assert.deepEqual(confirmProblems({ supplierId: null, employeeId: null, lines: [] }).length > 0, true);
assert.deepEqual(confirmProblems({ supplierId: 's', employeeId: 'e', lines: [spec] }), []);
assert.equal(orderTotals([spec, { quantity: 20, unitCost: 500 }, { quantity: 50, unitCost: null }]).amount, null);
assert.equal(orderTotals([spec, { quantity: 20, unitCost: 500 }]).amount, 24400);
assert.equal(orderTotals([spec]).units, 40);

assert.equal(transitionAllowed('draft', 'awaiting_receipt'), true);
assert.equal(transitionAllowed('partially_received', 'cancelled'), false);
assert.equal(transitionAllowed('completed', 'draft'), false);

const saved = new Map<string, { id: string }>();
const first = confirmOrder(saved, 'key-1', () => ({ id: 'order-1' }));
const second = confirmOrder(saved, 'key-1', () => ({ id: 'order-2' }));
assert.equal(second.replayed, true);
assert.equal(second.order.id, first.order.id);
assert.equal(orderNumber(['PO-3', 'PO-10']), 'PO-11');

const ordered: OrderLine[] = [{ ...spec, receivedQty: 0, agreedUnitCost: 360 }];
const after24 = receiveQuantities(ordered, [{ key: '1', quantity: 24 }]);
assert.equal(after24[0].receivedQty, 24);
assert.equal(statusAfterReceipt(after24), 'partially_received');
const after32 = receiveQuantities(after24, [{ key: '1', quantity: 8 }]);
assert.equal(after32[0].receivedQty, 32);
assert.equal(statusAfterReceipt(receiveQuantities(after32, [{ key: '1', quantity: 8 }])), 'completed');
assert.equal(receiveQuantities(after32, [{ key: '1', quantity: 100 }])[0].receivedQty, 40);

const order: PurchaseOrder = {
  id: 'order-1', number: 'PO-11', status: 'partially_received', completion: null,
  supplierId: 's', orderingEmployeeId: 'e', orderedOn: '2026-11-11', lines: after32, closeReason: null,
};
assert.equal(cancelOrder(order), null);
const closed = closeUnfulfilled(order, 'הספק לא ישלים');
assert.equal(closed?.status, 'completed');
assert.equal(closed?.completion, 'closed_unfulfilled');
assert.equal(closed?.lines[0].receivedQty, 32);

const candidate = { id: 'p', barcode: '123', brand: 'Michelin', model: 'Primacy 4', sizeLabel: '205/55R16', loadIndex: '91', speedRating: 'V' };
const other = { ...candidate, id: 'q', model: 'Pilot', loadIndex: '94', speedRating: 'W' };
assert.equal(matchProduct({ ...spec, productId: 'p' }, []).kind, 'existing');
assert.equal(matchProduct(spec, [candidate]).kind, 'existing');
assert.equal(matchProduct(spec, [candidate, { ...candidate, id: 'p2' }]).kind, 'ambiguous');
assert.equal(matchProduct(spec, [other]).kind, 'create');
assert.equal(matchProduct({ ...spec, speedRating: '' }, [other]).kind, 'insufficient');
assert.equal(matchByBarcode('123', [candidate, { ...candidate, id: 'z', barcode: '123' }]).kind, 'ambiguous');
assert.equal(supplierSkuConflict([{ sku: 'MIC', productId: 'p' }], 'MIC', 'q'), true);
assert.equal(supplierSkuConflict([{ sku: 'MIC', productId: 'p' }], 'MIC', 'p'), false);

assert.deepEqual(costChange(360, 370, 8), { changed: true, perUnit: 10, total: 80 });
assert.equal(costChange(360, null, 8).total, null);
assert.equal(costChange(360, 360, 8).changed, false);

const receipts = new Map();
const posted = postReceipt(receipts, 'r1', { '1': 24 });
const replay = postReceipt(receipts, 'r1', { '1': 24 });
assert.equal(replay.replayed, true);
assert.equal(replay.receipt, posted.receipt);
assert.equal(canReceive('draft'), false);
assert.equal(canReceive('partially_received'), true);
assert.equal(canReceive('completed'), false);
assert.equal(canCloseOpenBalance('awaiting_receipt'), false);
assert.equal(orderTotals([{ quantity: 10, unitCost: 100 }]).amount, 1000);
assert.equal(orderTotals([{ quantity: 10, unitCost: null }]).amount, null);
const listed: ListedOrder[] = [
  { id: '1', number: 'PO-2', orderedOn: '2026-11-02', supplierName: 'מישלין', employeeName: 'אושרי', status: 'awaiting_receipt' },
  { id: '2', number: 'PO-9', orderedOn: '2026-10-01', supplierName: 'פירלי', employeeName: 'לידור', status: 'draft' },
];
assert.equal(filterOrders(listed, 'מיש', 'all', 'all', '2026-11-11').length, 1);
assert.equal(filterOrders(listed, '', 'draft', 'month', '2026-11-11').length, 0);
assert.equal(receiptSteps.includes('insert-fifo-lot'), true);
assert.equal(receiptSteps.includes('increase-stock'), true);

console.log('phase14 purchase order assertions passed');
