import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUICK_SALE_PERSISTENCE_READY, V2_SALES_STACK_READY } from '@/lib/v2/employeeAttribution';
import {
  CUSTOMER_RETURN_READY,
  PURCHASE_ORDERS_READY,
  PURCHASE_RECEIPT_ATOMIC_READY,
  STOCK_ADJUSTMENT_RPC_READY,
  SUPPLIER_RETURN_DISPATCH_READY,
  SUPPLIER_RETURN_READY,
  SUPPLIER_RETURN_RESERVATION_READY,
} from '@/lib/v2/inventoryFlags';
import { LEGACY_SALE_ATOMIC_READY } from '@/lib/v2/legacySaleAtomic';
import { FIFO_AGING_READY, V2_REPORTS_SQL_READY } from '@/lib/v2/reportFlags';
import { quoteDraft } from '@/lib/v2/saleQuote';
import { V2_UI_DEFAULT_ENABLED } from '@/lib/v2/uiFlag';
import type { DraftLine } from '@/lib/v2/saleDraft';

assert.equal(V2_UI_DEFAULT_ENABLED, false);
assert.equal(V2_SALES_STACK_READY, false);
assert.equal(QUICK_SALE_PERSISTENCE_READY, false);
assert.equal(LEGACY_SALE_ATOMIC_READY, false);
assert.equal(PURCHASE_ORDERS_READY, false);
assert.equal(PURCHASE_RECEIPT_ATOMIC_READY, false);
assert.equal(STOCK_ADJUSTMENT_RPC_READY, false);
assert.equal(SUPPLIER_RETURN_READY, false);
assert.equal(SUPPLIER_RETURN_RESERVATION_READY, false);
assert.equal(SUPPLIER_RETURN_DISPATCH_READY, false);
assert.equal(CUSTOMER_RETURN_READY, false);
assert.equal(V2_REPORTS_SQL_READY, false);
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
assert.equal(productionLock.includes("IS DISTINCT FROM 'zijzwvkpjaxvdbvpcfow'"), false);

const isolatedLock = readFileSync('docs/v2/products-quantity-update-lock.UNAPPLIED.sql', 'utf8');
assert.match(isolatedLock, /production ref refused/);

const bi = readFileSync('docs/v2/bi-insights-known-cost.UNAPPLIED.sql', 'utf8');
assert.equal(bi.charCodeAt(0) === 0xfeff, false);
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
