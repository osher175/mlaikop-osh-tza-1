import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogStockView, incomingForCatalog, summarizeIncoming, type IncomingLine } from './importIncoming.ts';
import { identityKey, matchLegacyCatalog, matchTire, type CatalogIdentity, type LegacyTireRecord } from './importProductMatch.ts';

const business = 'biz-1';

function line(partial: Partial<IncomingLine>): IncomingLine {
  return {
    productId: 'p1',
    ordered: 10,
    received: 0,
    notArriving: 0,
    itemStatus: 'pending',
    orderStatus: 'ordered',
    estimatedArrival: '2026-12-01',
    ...partial,
  };
}

function tire(partial: Partial<CatalogIdentity> = {}): CatalogIdentity {
  return {
    businessId: business,
    productId: 'p1',
    brand: 'מותג',
    model: 'דגם',
    width: 205,
    aspect: 55,
    rim: 16,
    loadIndex: 91,
    speedRating: 'V',
    sku: 'SKU-1',
    ...partial,
  };
}

test('incoming uses open outstanding quantity and the earliest date', () => {
  const rows = summarizeIncoming([
    line({ estimatedArrival: '2027-02-01', ordered: 4 }),
    line({ estimatedArrival: '2026-12-15', ordered: 6, received: 1, notArriving: 1 }),
    line({ orderStatus: 'completed', ordered: 100, estimatedArrival: '2026-01-01' }),
    line({ orderStatus: 'cancelled', ordered: 100 }),
    line({ itemStatus: 'cancelled', ordered: 100 }),
    line({ productId: 'p2', ordered: 3, received: 3 }),
  ]);
  const first = rows.find((row) => row.productId === 'p1');
  assert.equal(first?.outstanding, 4 + 4);
  assert.equal(first?.earliestArrival, '2026-12-15');
  assert.equal(first?.arrivalCount, 2);
  assert.equal(rows.some((row) => row.productId === 'p2'), false);
});

test('a new incoming product hides zero stock and a stocked product keeps its quantity', () => {
  const incoming = summarizeIncoming([line({})])[0];
  const fresh = catalogStockView({ quantity: 0, incoming });
  assert.equal(fresh.showQuantity, false);
  assert.equal(fresh.incomingLabel, 'בדרך');
  assert.match(fresh.arrivalLabel ?? '', /01\.12\.2026/);
  const stocked = catalogStockView({ quantity: 12, incoming });
  assert.equal(stocked.showQuantity, true);
  assert.equal(stocked.incomingLabel, 'בדרך');
  const plain = catalogStockView({ quantity: 0, incoming: null });
  assert.equal(plain.showQuantity, true);
  assert.equal(plain.incomingLabel, null);
});

test('matching reuses an explicit id and refuses size-only or cross-business merges', () => {
  const catalog = [
    tire({}),
    tire({ productId: 'p2', brand: 'אחר', model: 'אחר', sku: 'SKU-2', width: 205, aspect: 55, rim: 16 }),
    tire({ productId: 'other-business', businessId: 'biz-2', sku: 'SKU-9' }),
  ];
  assert.equal(matchTire({ ...tire({}), productId: 'p1' }, catalog).status, 'selected');
  assert.equal(matchTire({ ...tire({ productId: null, sku: 'SKU-1', brand: 'לא משנה', model: 'לא משנה' }), productId: null }, catalog).status, 'ambiguous');
  assert.equal(matchTire({ ...tire({ productId: null, sku: 'SKU-1' }), productId: null }, catalog).status, 'matched');
  const sameSizeDifferentTire = matchTire({
    ...tire({ productId: null, sku: null, brand: 'מותג חדש', model: 'דגם חדש' }),
    productId: null,
    sku: null,
  }, catalog);
  assert.equal(sameSizeDifferentTire.status, 'none');
  assert.equal(matchTire({
    ...tire({ productId: null, sku: 'SKU-9', brand: 'זר', model: 'לא קיים' }),
    productId: null,
    sku: 'SKU-9',
    brand: 'זר',
    model: 'לא קיים',
  }, catalog).status, 'none');
});

test('ambiguous identity does not pick a product', () => {
  const catalog = [
    tire({ productId: 'a', sku: null }),
    tire({ productId: 'b', sku: null }),
  ];
  const result = matchTire({ ...tire({ productId: null, sku: null }), productId: null, sku: null }, catalog);
  assert.equal(result.status, 'ambiguous');
  assert.equal(identityKey(tire({})), identityKey(tire({ productId: 'b', sku: null })));
});

test('the same size with a different load code is not the same tire', () => {
  const catalog = [tire({ loadIndex: 91, speedRating: 'V', sku: null })];
  const differentLoad = matchTire({
    ...tire({ productId: null, sku: null, loadIndex: 94, speedRating: 'W' }),
    productId: null,
    sku: null,
  }, catalog);
  assert.equal(differentLoad.status, 'none');
  const sameSpeed = matchTire({
    ...tire({ productId: null, sku: null, loadIndex: 94, speedRating: 'V' }),
    productId: null,
    sku: null,
  }, catalog);
  assert.equal(sameSpeed.status, 'none');
  assert.notEqual(identityKey(tire({ loadIndex: 91, speedRating: 'V' })), identityKey(tire({ loadIndex: 104, speedRating: 'V' })));
});

test('a failed incoming read is not a zero and a saved date is kept', () => {
  const hidden = incomingForCatalog({ status: 'unavailable' }, { status: 'ok', quantity: 4 });
  assert.equal(typeof hidden === 'object' ? hidden?.outstanding : null, 4);
  assert.equal(typeof hidden === 'object' ? hidden?.earliestArrival : null, null);
  assert.equal(catalogStockView({ quantity: 0, incoming: hidden }).showQuantity, false);
  assert.equal(catalogStockView({ quantity: 0, incoming: hidden }).arrivalLabel, null);
  const dated = incomingForCatalog({
    status: 'ok',
    summary: {
      productId: 'p1',
      outstanding: 2,
      earliestArrival: '2026-12-01',
      arrivalCount: 1,
    },
  }, { status: 'ok', quantity: 0 });
  assert.equal(typeof dated === 'object' ? dated?.earliestArrival : null, '2026-12-01');
  assert.equal(incomingForCatalog({ status: 'ok', summary: null }, { status: 'ok', quantity: 0 }), null);
  const failed = incomingForCatalog({ status: 'unavailable' }, { status: 'unavailable' });
  assert.equal(failed, 'unavailable');
  const unknown = catalogStockView({ quantity: 0, incoming: failed });
  assert.equal(unknown.showQuantity, true);
  assert.equal(unknown.incomingLabel, null);
  assert.equal(unknown.incomingUnknown, true);
  const stocked = catalogStockView({ quantity: 8, incoming: failed });
  assert.equal(stocked.showQuantity, true);
  assert.equal(stocked.incomingUnknown, true);
});

test('a legacy product matches only when every stored attribute is present', () => {
  const wanted = tire({ productId: null, sku: null });
  const complete: LegacyTireRecord = {
    businessId: business,
    productId: 'legacy-1',
    brand: 'מותג',
    model: 'דגם',
    sizeLabel: '205/55R16',
    loadIndex: '91',
    speedRating: 'V',
  };
  assert.equal(matchLegacyCatalog(wanted, [complete]).status, 'matched');
  assert.equal(matchLegacyCatalog(wanted, [{ ...complete, speedRating: null }]).status, 'none');
  assert.equal(matchLegacyCatalog(wanted, [{ ...complete, loadIndex: '94' }]).status, 'none');
  assert.equal(matchLegacyCatalog(wanted, [{ ...complete, sizeLabel: '205/55R16 91V' }]).status, 'none');
  assert.equal(matchLegacyCatalog({ ...wanted, speedRating: null }, [complete]).status, 'none');
  assert.equal(matchLegacyCatalog(wanted, [complete, { ...complete, productId: 'legacy-2' }]).status, 'ambiguous');
  assert.equal(matchLegacyCatalog(wanted, [{ ...complete, businessId: 'biz-2' }]).status, 'none');
});
