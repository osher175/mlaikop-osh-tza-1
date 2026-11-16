import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { procurementTab } from '@/lib/v2/procurementTab';
import { PURCHASE_ORDERS_READY, PURCHASE_RECEIPT_ATOMIC_READY } from '@/lib/v2/inventoryFlags';
import {
  applyPurchaseOrderSave, explainPurchaseOrderError, persistenceRefusal, type LedgerOrder, type OrderTenant, type SaveOrderRequest,
} from '@/lib/v2/purchaseOrderSave';
import { purchaseOrdersQueryKey, type OrderLineInput } from '@/lib/v2/purchaseOrder';

assert.equal(PURCHASE_ORDERS_READY, false);
assert.equal(PURCHASE_RECEIPT_ATOMIC_READY, false);
assert.equal(persistenceRefusal(false), 'ספר ההזמנות כבוי. ההזמנה לא נשמרה.');
assert.equal(persistenceRefusal(true), null);

assert.equal(procurementTab(true, null), 'orders');
assert.equal(procurementTab(false, null), 'shortages');
assert.equal(procurementTab(true, 'shortages'), 'shortages');
assert.equal(procurementTab(true, 'requests'), 'requests');
assert.equal(procurementTab(true, 'settings'), 'settings');
assert.equal(procurementTab(true, 'orders'), 'orders');
assert.equal(procurementTab(false, 'orders'), 'shortages');
assert.equal(procurementTab(false, 'settings'), 'settings');
assert.equal(procurementTab(true, 'unknown'), 'orders');

const catalog: OrderLineInput = {
  key: '1', productId: 'p', brand: 'Michelin', model: 'Primacy 4', sizeLabel: '205/55R16',
  loadIndex: '91', speedRating: 'V', quantity: 4, unitCost: 100, supplierSku: null,
};
const spec: OrderLineInput = {
  key: '2', productId: null, brand: 'Radar', model: 'Dimax', sizeLabel: '195/65R15',
  loadIndex: '91', speedRating: 'H', quantity: 2, unitCost: null, supplierSku: 'RAD-1',
};
const tenant: OrderTenant = {
  callerUserId: 'owner', memberBusinessIds: ['b'], billingWritable: true,
  supplierIds: ['s'], activeEmployeeIds: ['e'], productIds: ['p'], nextOrderNumber: 1, stock: { p: 7 },
};
const draft = (patch: Partial<SaveOrderRequest> = {}): SaveOrderRequest => ({
  businessId: 'b', idempotencyKey: 'create-1', confirm: false, orderId: null, expectedVersion: null,
  supplierId: 's', employeeId: 'e', orderedOn: '2026-11-11', expectedOn: '2026-11-20',
  supplierReference: 'דני', notes: 'בלי מלאי', lines: [catalog], ...patch,
});

const created = applyPurchaseOrderSave([], draft(), tenant);
assert.equal(created.outcome.ok, true);
if (!created.outcome.ok) throw new Error('draft');
assert.equal(created.outcome.replayed, false);
assert.equal(created.outcome.order.status, 'draft');
assert.equal(created.outcome.order.number, null);
assert.equal(created.outcome.order.version, 1);
assert.equal(created.outcome.order.lines[0].receivedQty, 0);
assert.equal(created.tenant.stock, tenant.stock);
assert.equal(tenant.stock.p, 7);
assert.equal(created.orders.length, 1);

const replay = applyPurchaseOrderSave(created.orders, draft({ notes: 'שונה' }), created.tenant);
assert.equal(replay.outcome.ok && replay.outcome.replayed, true);
assert.equal(replay.orders.length, 1);
assert.equal(replay.orders[0].notes, 'בלי מלאי');

const sameKeyConfirm = applyPurchaseOrderSave(created.orders, draft({ confirm: true, notes: 'אישור' }), created.tenant);
assert.equal(sameKeyConfirm.outcome.ok && sameKeyConfirm.outcome.replayed, true);
assert.equal(sameKeyConfirm.orders[0].status, 'draft');
assert.equal(sameKeyConfirm.orders[0].number, null);
assert.equal(sameKeyConfirm.orders[0].notes, 'בלי מלאי');
assert.equal(tenant.stock.p, 7);

const edited = applyPurchaseOrderSave(created.orders, draft({
  idempotencyKey: 'edit-1', orderId: created.outcome.order.id, expectedVersion: 1, lines: [{ ...catalog, quantity: 6 }], notes: 'עודכן',
}), created.tenant);
assert.equal(edited.outcome.ok, true);
if (!edited.outcome.ok) throw new Error('edit');
assert.equal(edited.outcome.order.version, 2);
assert.equal(edited.outcome.order.status, 'draft');
assert.equal(edited.outcome.order.lines[0].quantity, 6);
assert.equal(edited.outcome.order.lines[0].receivedQty, 0);
assert.equal(tenant.stock.p, 7);

const retryEdit = applyPurchaseOrderSave(edited.orders, draft({
  idempotencyKey: 'edit-1', orderId: created.outcome.order.id, expectedVersion: 1, lines: [{ ...catalog, quantity: 9 }],
}), edited.tenant);
assert.equal(retryEdit.outcome.ok && retryEdit.outcome.replayed, true);
assert.equal(retryEdit.orders[0].lines[0].quantity, 6);

const conflict = applyPurchaseOrderSave(edited.orders, draft({
  idempotencyKey: 'edit-2', orderId: created.outcome.order.id, expectedVersion: 1, notes: 'ישן',
}), edited.tenant);
assert.equal(conflict.outcome.ok, false);
if (conflict.outcome.ok) throw new Error('conflict');
assert.equal(conflict.outcome.reason, 'conflict');
assert.equal(conflict.orders[0].version, 2);
assert.equal(conflict.orders[0].notes, 'עודכן');

const confirmed = applyPurchaseOrderSave(edited.orders, draft({
  idempotencyKey: 'confirm-1', confirm: true, orderId: created.outcome.order.id, expectedVersion: 2,
  lines: [{ ...catalog, quantity: 6 }], notes: 'עודכן',
}), edited.tenant);
assert.equal(confirmed.outcome.ok, true);
if (!confirmed.outcome.ok) throw new Error('confirm');
assert.equal(confirmed.outcome.order.status, 'awaiting_receipt');
assert.equal(confirmed.outcome.order.number, 'PO-1');
assert.equal(confirmed.outcome.order.lines[0].receivedQty, 0);
assert.equal(tenant.stock.p, 7);

const locked = applyPurchaseOrderSave(confirmed.orders, draft({
  idempotencyKey: 'edit-3', orderId: created.outcome.order.id, expectedVersion: confirmed.outcome.order.version, notes: 'אסור',
}), confirmed.tenant);
assert.equal(locked.outcome.ok, false);
if (locked.outcome.ok) throw new Error('locked');
assert.equal(locked.outcome.reason, 'immutable');
assert.equal(locked.orders[0].notes, 'עודכן');

const direct = applyPurchaseOrderSave(confirmed.orders, draft({ idempotencyKey: 'create-2', confirm: true }), confirmed.tenant);
assert.equal(direct.outcome.ok, true);
if (!direct.outcome.ok) throw new Error('direct');
assert.equal(direct.outcome.order.status, 'awaiting_receipt');
assert.equal(direct.outcome.order.number, 'PO-2');
assert.equal(direct.orders.length, 2);
assert.equal(tenant.stock.p, 7);

const missingSupplier = applyPurchaseOrderSave(direct.orders, draft({ idempotencyKey: 'bad', supplierId: null }), direct.tenant);
assert.equal(missingSupplier.outcome.ok, false);
if (missingSupplier.outcome.ok) throw new Error('invalid');
assert.equal(missingSupplier.outcome.reason, 'invalid');
assert.equal(missingSupplier.orders.length, 2);

const unknownCost = applyPurchaseOrderSave([], draft({ confirm: true, lines: [spec], idempotencyKey: 'cost' }), tenant);
assert.equal(unknownCost.outcome.ok, false);
const keptSpec = applyPurchaseOrderSave([], draft({ lines: [spec], idempotencyKey: 'spec' }), tenant);
assert.equal(keptSpec.outcome.ok, true);
if (!keptSpec.outcome.ok) throw new Error('spec');
assert.equal(keptSpec.outcome.order.status, 'draft');
assert.equal(keptSpec.outcome.order.lines[0].productId, null);
assert.equal(keptSpec.outcome.order.lines[0].unitCost, null);

const denied = applyPurchaseOrderSave(direct.orders, draft({ idempotencyKey: 'nope' }), { ...tenant, billingWritable: false });
assert.equal(denied.outcome.ok, false);
if (denied.outcome.ok) throw new Error('denied');
assert.equal(denied.outcome.reason, 'denied');
assert.equal(denied.orders, direct.orders);
assert.equal(tenant.stock.p, 7);

const member = applyPurchaseOrderSave([], draft({ idempotencyKey: 'member-own' }), tenant);
assert.equal(member.outcome.ok, true);
if (!member.outcome.ok) throw new Error('member');
assert.equal(member.outcome.order.businessId, 'b');

const nonMember = applyPurchaseOrderSave(member.orders, draft({ businessId: 'victim', idempotencyKey: 'steal' }), tenant);
assert.equal(nonMember.outcome.ok, false);
if (nonMember.outcome.ok) throw new Error('non-member');
assert.equal(nonMember.outcome.reason, 'denied');
assert.equal(nonMember.orders, member.orders);

const anonymous = applyPurchaseOrderSave(member.orders, draft({ idempotencyKey: 'anon' }), { ...tenant, callerUserId: null });
assert.equal(anonymous.outcome.ok, false);
if (anonymous.outcome.ok) throw new Error('anonymous');
assert.equal(anonymous.outcome.reason, 'denied');
assert.equal(anonymous.orders, member.orders);

const inactive = applyPurchaseOrderSave(member.orders, draft({ idempotencyKey: 'inactive' }), { ...tenant, billingWritable: false });
assert.equal(inactive.outcome.ok, false);
if (inactive.outcome.ok) throw new Error('inactive');
assert.equal(inactive.outcome.reason, 'denied');

const foreignSupplier = applyPurchaseOrderSave(member.orders, draft({ idempotencyKey: 'other-supplier', supplierId: 'foreign-supplier' }), tenant);
assert.equal(foreignSupplier.outcome.ok, false);
if (foreignSupplier.outcome.ok) throw new Error('supplier');
assert.equal(foreignSupplier.outcome.reason, 'invalid');
assert.equal(foreignSupplier.orders, member.orders);

const foreignEmployee = applyPurchaseOrderSave(member.orders, draft({ idempotencyKey: 'other-employee', employeeId: 'foreign-employee' }), tenant);
assert.equal(foreignEmployee.outcome.ok, false);
if (foreignEmployee.outcome.ok) throw new Error('employee');
assert.equal(foreignEmployee.outcome.reason, 'invalid');

const foreignProduct = applyPurchaseOrderSave(member.orders, draft({
  idempotencyKey: 'other-product-member', lines: [{ ...catalog, productId: 'foreign-product' }],
}), tenant);
assert.equal(foreignProduct.outcome.ok, false);
if (foreignProduct.outcome.ok) throw new Error('product');
assert.equal(foreignProduct.outcome.reason, 'invalid');

const leakedReplay = applyPurchaseOrderSave(created.orders, draft(), {
  ...tenant, callerUserId: 'stranger', memberBusinessIds: ['elsewhere'],
});
assert.equal(leakedReplay.outcome.ok, false);
if (leakedReplay.outcome.ok) throw new Error('replay');
assert.equal(leakedReplay.outcome.reason, 'denied');
assert.equal(leakedReplay.orders[0].notes, 'בלי מלאי');
assert.equal(leakedReplay.orders, created.orders);

const foreign = applyPurchaseOrderSave([], draft({ idempotencyKey: 'other-product', lines: [{ ...catalog, productId: 'other' }] }), tenant);
assert.equal(foreign.outcome.ok, false);

const ordersBefore: LedgerOrder[] = created.orders;
assert.equal(ordersBefore[0].lines.every((line) => line.receivedQty === 0), true);

const membership = (
  userId: string | null,
  businessId: string,
  rows: { userId: string; businessId: string }[],
  owners: { businessId: string; ownerId: string }[],
): boolean | null => {
  if (userId === null) return null;
  return rows.some((row) => row.userId === userId && row.businessId === businessId)
    || owners.some((owner) => owner.businessId === businessId && owner.ownerId === userId);
};
assert.equal(membership('owner', 'b', [{ userId: 'owner', businessId: 'b' }], []), true);
assert.equal(membership('owner', 'b', [], [{ businessId: 'b', ownerId: 'owner' }]), true);
assert.equal(membership('stranger', 'b', [{ userId: 'owner', businessId: 'b' }], []), false);
assert.equal(membership(null, 'b', [{ userId: 'owner', businessId: 'b' }], []), null);
const posedAsOwner = membership('owner', 'victim', [], [{ businessId: 'victim', ownerId: 'owner' }]);
assert.equal(posedAsOwner, true);
const saveUsesCaller = applyPurchaseOrderSave([], draft({ businessId: 'victim', idempotencyKey: 'posed' }), {
  ...tenant, callerUserId: 'stranger', memberBusinessIds: ['b'],
});
assert.equal(saveUsesCaller.outcome.ok, false);

const sql = readFileSync(new URL('../../../docs/v2/purchase-order-receipts.UNAPPLIED.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const guard = `IF auth.uid() IS NULL
     OR public.is_business_member(p_business_id, auth.uid()) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';`;
assert.equal(sql.split(guard).length - 1, 2);
const saveBody = sql.slice(sql.indexOf('AS $save$'), sql.indexOf('$save$;'));
const receiptBody = sql.slice(sql.indexOf('AS $post$'), sql.indexOf('$post$;'));
assert.equal(saveBody.indexOf(guard) < saveBody.indexOf('SELECT id INTO v_existing'), true);
assert.equal(saveBody.includes('inventory_lots'), false);
assert.equal(saveBody.includes('inventory_actions'), false);
assert.equal(saveBody.includes('UPDATE public.products'), false);
assert.equal(receiptBody.indexOf(guard) < receiptBody.indexOf('SELECT 1 FROM public.employees'), true);
assert.equal(sql.includes('REVOKE ALL ON TABLE'), true);
assert.equal(sql.includes('FROM PUBLIC, anon, authenticated;'), true);
assert.equal(sql.includes('GRANT SELECT ON TABLE'), true);
assert.equal(sql.includes('GRANT INSERT'), false);
assert.equal(sql.includes('GRANT UPDATE'), false);
assert.equal(sql.includes('GRANT DELETE'), false);
assert.equal(sql.includes('GRANT TRUNCATE'), false);
assert.equal(sql.includes('GRANT ALL'), false);
assert.equal(sql.includes('GRANT EXECUTE ON FUNCTION public.post_purchase_receipt'), false);
assert.equal(sql.includes('REVOKE ALL ON FUNCTION public.post_purchase_receipt(uuid, uuid, uuid, uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated, service_role;'), true);
assert.equal(sql.includes('REVOKE ALL ON FUNCTION public.save_purchase_order(uuid, uuid, boolean, uuid, uuid, date, jsonb, uuid, integer, date, text, text) FROM PUBLIC, anon, authenticated, service_role;'), true);
assert.equal(sql.includes('GRANT EXECUTE ON FUNCTION public.save_purchase_order(uuid, uuid, boolean, uuid, uuid, date, jsonb, uuid, integer, date, text, text) TO authenticated;'), true);
assert.equal(sql.includes('CREATE OR REPLACE FUNCTION public.record_purchase_receipt'), false);
assert.equal(sql.includes('CREATE OR REPLACE FUNCTION public.complete_quick_sale'), false);
assert.equal(sql.includes('ALTER TABLE public.products'), false);
assert.equal(sql.includes('ALTER TABLE public.inventory_actions'), false);
for (const role of ['anon', 'authenticated'] as const) {
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] as const) {
    assert.equal(sql.includes(`GRANT ${privilege}`), false, `${role} ${privilege}`);
  }
}
assert.equal(sql.includes('TO anon'), false);

assert.deepEqual(purchaseOrdersQueryKey('b'), ['purchase-orders', 'b']);
assert.deepEqual(purchaseOrdersQueryKey(null), ['purchase-orders', null]);
assert.equal(explainPurchaseOrderError('access denied'), 'אין הרשאה לשמור הזמנת רכש.');
assert.equal(explainPurchaseOrderError('version conflict'), 'ההזמנה עודכנה במקום אחר. פתחו אותה מחדש לפני שמירה.');
assert.equal(explainPurchaseOrderError('order is not a draft'), 'הזמנה שסוכמה אינה נפתחת לעריכה.');
assert.equal(explainPurchaseOrderError('supplier not found'), 'הספק אינו שייך לעסק הזה.');
assert.equal(explainPurchaseOrderError('employee not found'), 'העובד אינו פעיל בעסק הזה.');
assert.equal(explainPurchaseOrderError('product not found'), 'המוצר אינו שייך לעסק הזה.');
assert.equal(explainPurchaseOrderError('database exploded'), 'ההזמנה לא נשמרה. הנתונים בטופס נשארו.');

const failedRetry = applyPurchaseOrderSave([], draft({ supplierId: null, idempotencyKey: 'retry-key' }), tenant);
assert.equal(failedRetry.outcome.ok, false);
assert.equal(failedRetry.orders.length, 0);
assert.equal(failedRetry.tenant.stock.p, 7);
const retried = applyPurchaseOrderSave(failedRetry.orders, draft({ idempotencyKey: 'retry-key' }), failedRetry.tenant);
assert.equal(retried.outcome.ok && retried.outcome.replayed === false, true);
assert.equal(retried.orders.length, 1);
assert.equal(retried.orders[0].status, 'draft');
assert.equal(retried.tenant.stock.p, 7);

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const write = source('./purchaseOrderWrite.ts');
const saveFn = write.slice(write.indexOf('export async function savePurchaseOrder'));
assert.equal(saveFn.indexOf('persistenceRefusal(ordersWritable())') < saveFn.indexOf("supabase.rpc('save_purchase_order'"), true);
assert.equal(write.includes('if (!ordersWritable()) refused();'), true);
assert.equal(write.includes('.insert('), false);
assert.equal(write.includes('.update('), false);
assert.equal(write.includes('.delete('), false);
assert.equal(write.includes('service_role'), false);
assert.equal(write.includes('p_business_id: request.businessId'), true);
assert.equal(write.includes('auth.uid'), false);

const dialog = source('../../components/v2/procurement/NewPurchaseOrderDialog.tsx');
assert.equal(dialog.includes('businessId: activeBusinessId'), true);
assert.equal(dialog.includes('idempotencyKey: requestKey.current'), true);
assert.equal(dialog.indexOf('setSealed(true)') < dialog.indexOf('await onSaved?.({ id: saved.id, confirm })'), true);
assert.equal(dialog.includes("שמירה כטיוטה"), true);
assert.equal(dialog.includes("שמירת הזמנה"), true);

const hook = source('../../hooks/v2/usePurchaseOrders.ts');
assert.equal(hook.includes('purchaseOrdersQueryKey(activeBusinessId)'), true);
assert.equal(hook.includes('enabled: available && !!activeBusinessId'), true);

const screen = source('../../components/v2/procurement/PurchaseOrdersV2.tsx');
const savedHandler = screen.slice(screen.indexOf('onSaved={async'));
assert.equal(savedHandler.indexOf('await ledger.reload()') < savedHandler.indexOf('setCreating(false);'), true);
assert.equal(screen.includes("selected.status === 'draft' && writable"), true);

console.log('phase15 purchase order persistence assertions passed');
