import assert from 'node:assert/strict';
import { PURCHASE_ORDERS_READY, PURCHASE_RECEIPT_ATOMIC_READY } from '@/lib/v2/inventoryFlags';
import {
  applyDelivery, applyMode, beginSubmit, closeUnfulfilled, lineCost, openQty, quantityToReceive,
  setLineQty, setLineSelected, summarizeReceipt, toDraft, type PurchaseOrderView, type ReceiptLine,
} from '@/lib/v2/goodsReceipt';

assert.equal(PURCHASE_ORDERS_READY, false);
assert.equal(PURCHASE_RECEIPT_ATOMIC_READY, false);

const line = (patch: Partial<ReceiptLine>): ReceiptLine => ({
  id: 'a', productName: 'צמיג', specification: '205/55R16', orderedQty: 40, previouslyReceivedQty: 0,
  unitCost: 360, selected: true, receiveQty: 0, ...patch,
});

assert.equal(openQty(line({ previouslyReceivedQty: 24 })), 16);
assert.equal(setLineQty([line({ receiveQty: 0 })], 'a', -3).message !== null, true);
assert.equal(setLineQty([line({ previouslyReceivedQty: 24, receiveQty: 0 })], 'a', 40).lines[0].receiveQty, 16);

const unchecked = setLineSelected([line({ receiveQty: 8 })], 'a', false)[0];
assert.equal(quantityToReceive(unchecked), 0);
assert.equal(lineCost(unchecked), 0);

const known = line({ receiveQty: 8, unitCost: 360 });
const unknown = line({ id: 'b', receiveQty: 2, unitCost: null, selected: true });
assert.equal(lineCost(known), 2880);
assert.equal(lineCost(unknown), null);
assert.equal(summarizeReceipt([known, unknown]).currentCost, null);
assert.equal(summarizeReceipt([known, line({ id: 'c', unitCost: 0, receiveQty: 2 })]).currentCost, 2880);

const partialOrder: PurchaseOrderView = {
  id: 'po', number: null, orderedOn: null, supplierName: null, status: 'open',
  lines: [line({ receiveQty: 24 })],
};
const first = applyDelivery(partialOrder, partialOrder.lines);
assert.equal(first.lines[0].previouslyReceivedQty, 24);
assert.equal(first.status, 'partial');
const secondDraft = applyMode(first.lines.map((row) => ({ ...row, selected: true, receiveQty: 8 })), 'partial');
const second = applyDelivery(first, secondDraft);
assert.equal(second.lines[0].previouslyReceivedQty, 32);
assert.equal(openQty(second.lines[0]), 8);
const full = applyMode(second.lines, 'full');
assert.equal(full[0].receiveQty, 8);
assert.equal(applyDelivery(second, full).status, 'received');

const closed = closeUnfulfilled(second);
assert.equal(closed.status, 'closed_unfulfilled');
assert.equal(closed.lines[0].previouslyReceivedQty, 32);
assert.equal(quantityToReceive(closed.lines[0]), 0);

assert.equal(beginSubmit(false), true);
assert.equal(beginSubmit(true), false);
const draft = toDraft('po', 'partial', '', false, [known]);
assert.equal(draft.posted, false);
assert.equal(applyMode([line({ previouslyReceivedQty: 24, orderedQty: 40, receiveQty: 1 })], 'full')[0].receiveQty, 16);

console.log('phase14 assertions passed');
