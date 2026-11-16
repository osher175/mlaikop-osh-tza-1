import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOrderCard,
  dashboardView,
  filterCards,
  isApproaching,
  isDelayed,
  orderDetailView,
  stageProgressLabel,
  summarizeKpis,
  type DashboardItem,
  type DashboardOrder,
  type DashboardPayment,
} from './importDashboardMetrics.ts';

const today = '2026-11-12';

function order(patch: Partial<DashboardOrder> = {}): DashboardOrder {
  return {
    id: 'a',
    importNumber: 'IMP-1',
    status: 'in_transit',
    currencyCode: 'USD',
    orderDate: '2026-09-01',
    estimatedArrival: '2026-11-15',
    actualArrival: null,
    commercialStatus: 'confirmed',
    supplierId: 's1',
    supplierName: 'Michelin',
    supplierReference: null,
    ...patch,
  };
}

function item(patch: Partial<DashboardItem> = {}): DashboardItem {
  return {
    orderId: 'a',
    orderedQuantity: 10,
    receivedQuantity: 0,
    unitCost: 20,
    currencyCode: 'USD',
    description: 'Pilot Sport',
    sku: 'MIC-1',
    brandName: 'Michelin',
    itemStatus: 'ordered',
    ...patch,
  };
}

test('value stays in the order currency and an unknown cost is not zero', () => {
  const card = buildOrderCard(order(), [item(), item({ unitCost: null, description: 'unknown' })], [], today);
  assert.equal(card.goodsAmount, null);
  assert.equal(card.tireQuantity, 20);
  assert.equal(card.paymentPercent, null);
});

test('supplier percent ignores freight and a different payment currency', () => {
  const payments: DashboardPayment[] = [
    { orderId: 'a', amount: 50, currencyCode: 'USD', paymentStatus: 'paid', paymentType: 'deposit', importCostId: null },
    { orderId: 'a', amount: 999, currencyCode: 'ILS', paymentStatus: 'paid', paymentType: 'supplier_payment', importCostId: null },
    { orderId: 'a', amount: 40, currencyCode: 'USD', paymentStatus: 'paid', paymentType: 'freight_payment', importCostId: null },
    { orderId: 'a', amount: 10, currencyCode: 'USD', paymentStatus: 'planned', paymentType: 'balance', importCostId: null },
  ];
  const card = buildOrderCard(order(), [item()], payments, today);
  assert.equal(card.goodsAmount, 200);
  assert.equal(card.paidAmount, 50);
  assert.equal(card.paymentPercent, 25);
});

test('currencies are not added into one total', () => {
  const usd = buildOrderCard(order(), [item()], [], today);
  const eur = buildOrderCard(
    order({ id: 'b', currencyCode: 'EUR', importNumber: 'IMP-2' }),
    [item({ orderId: 'b', currencyCode: 'EUR', unitCost: 5, orderedQuantity: 4 })],
    [],
    today,
  );
  const kpis = summarizeKpis([usd, eur]);
  assert.equal(kpis.activeOrders, 2);
  assert.equal(kpis.tireQuantity, 14);
  assert.deepEqual(kpis.valueByCurrency.map((row) => [row.currency, row.amount]), [['USD', 200], ['EUR', 20]]);
});

test('delay and approaching follow real dates only', () => {
  const late = order({ estimatedArrival: '2026-11-01', status: 'shipped' });
  const soon = order({ id: 'b', estimatedArrival: '2026-11-18', status: 'preparing' });
  const undated = order({ id: 'c', estimatedArrival: null, status: 'ordered' });
  const arrived = order({ id: 'd', estimatedArrival: '2026-11-01', status: 'arrived_israel' });
  assert.equal(isDelayed(late, today), true);
  assert.equal(isApproaching(soon, today), true);
  assert.equal(isDelayed(undated, today), false);
  assert.equal(isApproaching(undated, today), false);
  assert.equal(isDelayed(arrived, today), false);
  const kpis = summarizeKpis([
    buildOrderCard(late, [], [], today),
    buildOrderCard(soon, [], [], today),
    buildOrderCard(undated, [], [], today),
  ]);
  assert.equal(kpis.approachingReceipt, 1);
});

test('completed orders stay in the list and out of the active KPIs', () => {
  const cards = [
    buildOrderCard(order({ status: 'completed', importNumber: 'IMP-CLOSED' }), [item({ orderedQuantity: 8 })], [], today),
  ];
  const kpis = summarizeKpis(cards);
  assert.equal(cards.length, 1);
  assert.equal(kpis.activeOrders, 0);
  assert.equal(kpis.tireQuantity, 0);
  assert.equal(kpis.valueByCurrency.length, 0);
  assert.equal(kpis.approachingReceipt, 0);
});

test('an empty business and a failed query are different views', () => {
  assert.equal(dashboardView({ isLoading: false, isError: false, orderCount: 0, visibleCount: 0 }), 'empty');
  assert.equal(dashboardView({ isLoading: false, isError: true, orderCount: 0, visibleCount: 0 }), 'error');
  assert.equal(dashboardView({ isLoading: false, isError: false, orderCount: 2, visibleCount: 0 }), 'filtered-empty');
  assert.equal(orderDetailView({ isLoading: false, isError: true, hasOrder: false }), 'error');
  assert.equal(orderDetailView({ isLoading: false, isError: false, hasOrder: false }), 'missing');
});

test('cancelled orders stay out of the active KPIs', () => {
  const cards = [
    buildOrderCard(order({ status: 'completed' }), [item({ orderedQuantity: 100 })], [], today),
    buildOrderCard(order({ id: 'b', status: 'cancelled' }), [item({ orderId: 'b', orderedQuantity: 50 })], [], today),
    buildOrderCard(order({ id: 'c', status: 'ordered' }), [item({ orderId: 'c', orderedQuantity: 3 })], [], today),
  ];
  const kpis = summarizeKpis(cards);
  assert.equal(kpis.activeOrders, 1);
  assert.equal(kpis.tireQuantity, 3);
});

test('order progress is a stage count, not a percent of the stage index', () => {
  assert.equal(stageProgressLabel('ordered'), 'הוזמן · 1 מתוך 8');
  assert.equal(stageProgressLabel('in_transit').includes('%'), false);
  assert.equal(stageProgressLabel('cancelled'), 'בוטל');
  assert.equal(stageProgressLabel('mystery'), 'מצב לא מוגדר');
});

test('search matches a tire brand and the period filter uses the order date', () => {
  const cards = [
    buildOrderCard(order({ orderDate: '2026-11-01' }), [item()], [], today),
    buildOrderCard(order({ id: 'b', importNumber: 'IMP-9', orderDate: '2024-01-01', supplierName: 'Other' }), [item({ orderId: 'b', brandName: 'Falken', description: 'Azenis' })], [], today),
  ];
  assert.equal(filterCards(cards, { search: 'falken', status: '', supplierId: '', period: 'all' }, today).length, 1);
  assert.equal(filterCards(cards, { search: '', status: '', supplierId: '', period: '30' }, today).length, 1);
});
