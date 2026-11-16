import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUPPLIER_RETURN_DISPATCH_READY, SUPPLIER_RETURN_RESERVATION_READY, SUPPLIER_RETURN_READY } from '@/lib/v2/inventoryFlags';
import { isNavActive } from '@/components/v2/navConfig';
import {
  DISPATCH_CONFIRMATION,
  RESERVATION_CLOSED,
  returnDraftIssues,
  returnDraftTotal,
  returnQuantityValid,
  supplierReturnCanonical,
  supplierReturnPostingClosed,
} from '@/lib/v2/supplierReturnDraft';

assert.equal(SUPPLIER_RETURN_READY, false);
assert.equal(SUPPLIER_RETURN_RESERVATION_READY, false);
assert.equal(SUPPLIER_RETURN_DISPATCH_READY, false);
assert.equal(returnDraftTotal([{ quantity: 2, unitCost: 0 }, { quantity: 1, unitCost: 10 }]), 10);
assert.equal(returnDraftTotal([{ quantity: 2, unitCost: 0 }, { quantity: 1, unitCost: null }]), null);
const canonical = {
  businessId: 'b',
  supplierId: 's',
  reasonId: 'defect',
  notes: ' הערה ',
  lines: [
    { productId: 'b-product', quantity: 1, unitCost: 0 },
    { productId: 'a-product', quantity: 2, unitCost: null },
  ],
};
assert.equal(supplierReturnCanonical(canonical), supplierReturnCanonical({ ...canonical, lines: [...canonical.lines].reverse() }));
assert.notEqual(
  supplierReturnCanonical(canonical),
  supplierReturnCanonical({ ...canonical, lines: [{ productId: 'a-product', quantity: 2, unitCost: 0 }, { productId: 'b-product', quantity: 1, unitCost: 0 }] }),
);
assert.equal(returnQuantityValid(1, 4), true);
assert.equal(returnQuantityValid(4, 4), true);
assert.equal(returnQuantityValid(5, 4), false);
assert.equal(returnQuantityValid(0, 4), false);
assert.equal(returnQuantityValid(1.5, 4), false);

const onHand = 6;
const issues = returnDraftIssues({
  supplierId: 'supplier',
  reasonId: 'defect',
  lines: [{ productId: 'p', quantity: 2, unitCost: 360, onHand }],
});
assert.deepEqual(issues, []);
assert.equal(onHand, 6);
assert.equal(returnDraftTotal([{ quantity: 2, unitCost: 360 }, { quantity: 4, unitCost: 500 }]), 2720);
assert.equal(returnDraftTotal([{ quantity: 2, unitCost: null }]), null);
assert.equal(returnDraftTotal([]), null);
assert.ok(returnDraftIssues({
  supplierId: null,
  reasonId: '',
  lines: [
    { productId: 'p', quantity: 2, unitCost: 10, onHand: 1 },
    { productId: 'p', quantity: 1, unitCost: 10, onHand: 4 },
  ],
}).length >= 3);

const closed = supplierReturnPostingClosed();
assert.equal(closed?.reservation, RESERVATION_CLOSED);

assert.equal(isNavActive('/procurement/returns', '/procurement/returns'), true);
assert.equal(isNavActive('/procurement/returns', '/procurement'), false);
assert.equal(isNavActive('/procurement', '/procurement'), true);
assert.equal(isNavActive('/procurement/receiving', '/procurement'), true);

const screen = readFileSync('src/components/v2/procurement/SupplierReturnsV2.tsx', 'utf8');
const draft = readFileSync('src/lib/v2/supplierReturnDraft.ts', 'utf8');
const orders = readFileSync('src/components/v2/procurement/PurchaseOrdersV2.tsx', 'utf8');
const lifecycle = readFileSync('src/lib/v2/inventoryLifecycle.ts', 'utf8');
const sql = readFileSync('docs/v2/supplier-return-dispatch.UNAPPLIED.sql', 'utf8');
assert.match(draft, /שריון המלאי כבוי/);
assert.match(draft, new RegExp(DISPATCH_CONFIRMATION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(screen, /\{DISPATCH_CONFIRMATION\}/);
assert.match(screen, /disabled=\{!SUPPLIER_RETURN_DISPATCH_READY \|\| pending\}/);
assert.match(screen, /LEDGER_UNAVAILABLE/);
assert.equal(screen.includes('recordSupplierReturn'), false);
assert.equal(screen.includes('.update('), false);
assert.equal(screen.includes('.insert('), false);
assert.match(lifecycle, /if \(!SUPPLIER_RETURN_DISPATCH_READY\) closed\(/);
const dispatchStart = lifecycle.indexOf('export async function confirmSupplierReturnDispatch');
const rpcAt = lifecycle.indexOf("rpc('confirm_supplier_return_dispatch'", dispatchStart);
const guardAt = lifecycle.indexOf('if (!SUPPLIER_RETURN_DISPATCH_READY)', dispatchStart);
assert.ok(guardAt > dispatchStart && guardAt < rpcAt);
const fn = sql.slice(
  sql.indexOf('CREATE OR REPLACE FUNCTION public.confirm_supplier_return_dispatch'),
  sql.indexOf('$dispatch$;') + '$dispatch$;'.length,
);
assert.match(fn, /sale_total_ils, sale_unit_ils, salesperson_employee_id/);
assert.match(fn, /p_supplier_id, v_cost, NULL, NULL, NULL/);
assert.equal(fn.includes('sale_items'), false);
assert.equal(fn.includes('sale_transactions'), false);
assert.match(sql, /idempotency key reused with a different supplier return/);
assert.match(sql, /credit_status', 'not_recorded'/);
assert.match(sql, /DO NOT EXECUTE/);
assert.match(sql, /outside supabase\/migrations/);
assert.match(orders, /to="\/procurement\/returns"/);
assert.equal(orders.includes("to=\"/movements\""), false);

console.log('supplier return draft assertions passed');
