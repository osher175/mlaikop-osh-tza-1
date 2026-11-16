import assert from 'node:assert/strict';
import test from 'node:test';
import {
  centerHrefFromSearch,
  filtersFromSearch,
  filtersToSearch,
  orderHref,
  orderTabFromSearch,
} from './importCenterNavigation.ts';

test('order details use the record id', () => {
  const id = '6f0c2c2e-1b4a-4e3a-9c1d-0a0b0c0d0e0f';
  assert.equal(orderHref(id), `/import/${id}`);
  assert.equal(orderHref(id).includes('IMP-2026'), false);
});

test('a tab stays on the same order', () => {
  const id = 'order-1';
  assert.equal(orderHref(id, 'payments'), `/import/${id}?tab=payments`);
  assert.equal(orderHref(id, 'products'), `/import/${id}`);
  assert.equal(orderHref(id, 'not-a-tab'), `/import/${id}`);
  assert.equal(orderTabFromSearch('tab=receipts'), 'receipts');
  assert.equal(orderTabFromSearch('tab=elsewhere'), 'products');
});

test('center filters survive a round trip through the query string', () => {
  const search = filtersToSearch({
    search: 'מספר',
    status: 'in_transit',
    supplierId: 'supplier-1',
    period: '30',
  });
  assert.deepEqual(filtersFromSearch(search), {
    search: 'מספר',
    status: 'in_transit',
    supplierId: 'supplier-1',
    period: '30',
  });
  assert.equal(centerHrefFromSearch(search), `/import?${search}`);
  assert.equal(centerHrefFromSearch(''), '/import');
});
