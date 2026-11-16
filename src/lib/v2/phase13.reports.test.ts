import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIFO_AGING_READY, V2_REPORTS_SQL_READY } from '@/lib/v2/reportFlags';
import {
  discountCoverage, grossProfitExVat, marginPct, presentLiveOverview, reportsAggregateBounds,
  revenueChangePct, revenueExVat, summarizeAging,
} from '@/lib/v2/reportMetrics';
import { allocateFifo, restockReturn, reverseFifo, type FifoState } from '@/lib/v2/fifoAllocator';

assert.equal(V2_REPORTS_SQL_READY, false);
assert.equal(FIFO_AGING_READY, false);

assert.equal(revenueExVat(118), 100);
assert.equal(grossProfitExVat(118, 40, 2), 20);
assert.equal(grossProfitExVat(118, null, 2), null);
assert.equal(marginPct(20, 118), 20);
assert.equal(revenueChangePct(110, 100), 10);
assert.equal(revenueChangePct(110, 0), null);

const presented = presentLiveOverview({
  timeline_breakdown: [{ date: '2026-11-01', sales_amount: 50 }, { date: '2026-11-02', sales_amount: 70 }],
  total_added: 4,
  gross_profit: 999,
  net_profit: 999,
  total_value: 999,
}, false);
assert.equal(presented.revenueGross, 120);
assert.equal(presented.unitsReceived, 4);
assert.equal(presented.grossProfit, null);
assert.equal(presented.inventoryValue, null);
assert.equal(presented.verifiedDiscount, null);
assert.equal(presentLiveOverview(null, true).revenueGross, null);
assert.equal(presentLiveOverview({ timeline_breakdown: [{ date: '2026-11-01' }] }, false).revenueGross, null);

const bounds = reportsAggregateBounds('2026-11-01T00:00:00.000Z', '2026-11-02T00:00:00.000Z');
assert.equal(bounds.date_to, '2026-11-01T23:59:59.000Z');

const coverage = discountCoverage([
  { referenceType: 'legacy_sale_request', listUnitIls: 100, discountIls: 0, discountPercent: 0, salespersonEmployeeId: null, transactionId: 'a', productId: 'p', quantity: 1, saleTotalIls: 100 },
  { referenceType: 'legacy_sale_request', listUnitIls: 100, discountIls: 20, discountPercent: 20, salespersonEmployeeId: null, transactionId: 'b', productId: 'p', quantity: 1, saleTotalIls: 80 },
  { referenceType: 'sale_transaction', listUnitIls: 80, discountIls: 0, discountPercent: 0, salespersonEmployeeId: null, transactionId: 'c', productId: 'p', quantity: 1, saleTotalIls: 80 },
]);
assert.equal(coverage.knownAmount, 20);
assert.equal(coverage.fullPriceRows, 1);
assert.equal(coverage.discountedRows, 1);
assert.equal(coverage.unknownRows, 1);

const asOf = new Date('2026-11-11T00:00:00.000Z');
const aging = summarizeAging([
  { remainingQty: 2, receivedAt: '2026-11-01T00:00:00.000Z', unitCost: 50 },
  { remainingQty: 4, receivedAt: null, unitCost: 50 },
], asOf);
assert.equal(aging.knownUnits, 2);
assert.equal(aging.unknownUnits, 4);
assert.equal(aging.weightedAverageDays, 10);
assert.equal(aging.buckets.unknown.units, 4);
assert.equal(aging.buckets['0-30'].units, 2);
assert.equal(aging.knownValue, 100);

const state: FifoState = {
  lots: [
    { id: 'old', productId: 'p', receivedAt: '2026-01-01T00:00:00.000Z', remainingQty: 2, unitCost: 10, source: 'purchase_receipt' },
    { id: 'new', productId: 'p', receivedAt: '2026-06-01T00:00:00.000Z', remainingQty: 5, unitCost: 12, source: 'purchase_receipt' },
    { id: 'unknown', productId: 'p', receivedAt: null, remainingQty: 9, unitCost: null, source: 'opening_unknown' },
  ],
  exits: new Map(),
};
const first = allocateFifo(state, 'k1', 'p', 3, 'sale');
assert.equal(first.ok, true);
assert.deepEqual(first.allocations.map((row) => [row.lotId, row.quantity]), [['old', 2], ['new', 1]]);
assert.equal(first.state.lots.find((lot) => lot.id === 'unknown')?.remainingQty, 9);
const replay = allocateFifo(first.state, 'k1', 'p', 3, 'sale');
assert.equal(replay.reason, 'replay');
assert.equal(replay.state.lots.find((lot) => lot.id === 'new')?.remainingQty, 4);
const short = allocateFifo(first.state, 'k2', 'p', 100, 'sale');
assert.equal(short.ok, false);
assert.equal(short.state.lots.find((lot) => lot.id === 'new')?.remainingQty, 4);
const restored = reverseFifo(first.state, 'k1');
assert.equal(restored.state.lots.find((lot) => lot.id === 'old')?.remainingQty, 2);
const again = reverseFifo(restored.state, 'k1');
assert.equal(again.reason, 'replay');
const restocked = restockReturn(first.state, {
  id: 'back', productId: 'p', receivedAt: '2026-11-11T00:00:00.000Z', remainingQty: 1, unitCost: 10, source: 'customer_return_restock',
});
assert.equal(restocked.lots.find((lot) => lot.id === 'old')?.remainingQty, 0);
assert.equal(restocked.lots.find((lot) => lot.id === 'back')?.remainingQty, 1);
const transfer = allocateFifo(state, 't', 'p', 1, 'transfer');
assert.equal(transfer.reason, 'unsupported');
assert.equal(transfer.state, state);

const reports = readFileSync('src/components/v2/reports/ReportsV2.tsx', 'utf8');
const drill = readFileSync('src/components/v2/reports/ReportDrilldown.tsx', 'utf8');
assert.equal(reports.includes('to="/reports/'), false);
assert.equal(reports.includes('ReportDrilldown'), true);
assert.equal(reports.includes('שווי מלאי נוכחי'), true);
assert.equal(reports.includes('התפלגות שווי מלאי לפי גיל'), true);
assert.equal(reports.includes('240,000'), false);
assert.equal(reports.includes('16,420'), false);
assert.equal(drill.includes('Dialog'), true);
assert.equal(drill.includes('סגירה'), true);
assert.equal(readFileSync('src/pages/Reports.tsx', 'utf8').includes('LegacyReports'), true);

console.log('phase13 assertions passed');
