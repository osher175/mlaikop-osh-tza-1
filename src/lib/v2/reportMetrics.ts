import { VAT_RATE } from '@/lib/v2/dashboardMetrics';
import { knownStoredDiscount, type StoredDiscountRow } from '@/lib/v2/saleDiscount';

export const VAT_DIVISOR = 1 + VAT_RATE;

/** VAT-inclusive revenue divided by 1.18. Null stays null. */
/** Live reports_aggregate treats date_to as inclusive to the next second. */
export function reportsAggregateBounds(startIso: string, endExclusiveIso: string) {
  return {
    date_from: startIso,
    date_to: new Date(new Date(endExclusiveIso).getTime() - 1000).toISOString(),
  };
}

export function revenueChangePct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function revenueExVat(gross: number | null): number | null {
  if (gross === null || !Number.isFinite(gross)) return null;
  return gross / VAT_DIVISOR;
}

/**
 * Gross profit is ex-VAT revenue minus known unit cost times quantity.
 * A missing cost stays out of profit. This is not net business profit.
 */
export function grossProfitExVat(
  revenueGross: number | null,
  unitCost: number | null,
  quantity: number,
): number | null {
  if (revenueGross === null || unitCost === null) return null;
  if (!Number.isFinite(revenueGross) || !Number.isFinite(unitCost) || !Number.isFinite(quantity)) return null;
  return revenueExVat(revenueGross)! - unitCost * Math.abs(quantity);
}

export function marginPct(profit: number | null, revenueGross: number | null): number | null {
  const net = revenueExVat(revenueGross);
  if (profit === null || net === null || net === 0) return null;
  return (profit / net) * 100;
}

export interface TimelinePoint {
  date: string;
  sales_amount?: number | null;
}

/**
 * Sum of daily VAT-inclusive sale totals from a complete SQL timeline.
 * An empty timeline is a real zero for that window. A missing amount is not zero.
 */
export function revenueFromTimeline(rows: TimelinePoint[] | null | undefined): number | null {
  if (!rows) return null;
  let total = 0;
  for (const row of rows) {
    if (row.sales_amount === null || row.sales_amount === undefined || !Number.isFinite(Number(row.sales_amount))) {
      return null;
    }
    total += Number(row.sales_amount);
  }
  return total;
}

export interface LiveAggregate {
  timeline_breakdown?: TimelinePoint[] | null;
  total_added?: number | null;
  gross_profit?: number | null;
  net_profit?: number | null;
  total_value?: number | null;
}

export interface PresentedOverview {
  /** VAT-inclusive revenue. Null when the figure must not be shown. */
  revenueGross: number | null;
  grossProfit: null;
  marginPct: null;
  inventoryValue: null;
  verifiedDiscount: null;
  /** Receipt units in the window. Not a payment and not current stock. */
  unitsReceived: number | null;
}

/**
 * The live reports_aggregate profit fields treat a missing cost as zero and
 * subtract it from VAT-inclusive revenue. Those fields are dropped.
 * Revenue is kept only when no extra filter is active, because that function
 * cannot apply a product, brand, or supplier filter.
 */
export function presentLiveOverview(input: LiveAggregate | null, extraFilter: boolean): PresentedOverview {
  const hidden: PresentedOverview = {
    revenueGross: null,
    grossProfit: null,
    marginPct: null,
    inventoryValue: null,
    verifiedDiscount: null,
    unitsReceived: null,
  };
  if (!input || extraFilter) return hidden;
  return {
    ...hidden,
    revenueGross: Array.isArray(input.timeline_breakdown) ? revenueFromTimeline(input.timeline_breakdown) : null,
    unitsReceived: Number.isFinite(Number(input.total_added)) ? Number(input.total_added) : null,
  };
}

export interface DiscountCoverage {
  knownAmount: number;
  fullPriceRows: number;
  discountedRows: number;
  unknownRows: number;
}

/** Counts stored discounts only. A missing list price is unknown, not zero. */
export function discountCoverage(rows: StoredDiscountRow[]): DiscountCoverage {
  let knownAmount = 0;
  let fullPriceRows = 0;
  let discountedRows = 0;
  let unknownRows = 0;
  for (const row of rows) {
    const known = knownStoredDiscount(row);
    if (!known) {
      unknownRows += 1;
      continue;
    }
    knownAmount += known.amount;
    if (known.amount > 0) discountedRows += 1;
    else fullPriceRows += 1;
  }
  return { knownAmount, fullPriceRows, discountedRows, unknownRows };
}

export type AgeBucket = '0-30' | '31-90' | '91-180' | 'over-180' | 'unknown';

export function ageDays(receivedAt: string | null, asOf: Date): number | null {
  if (!receivedAt) return null;
  const received = new Date(receivedAt);
  if (Number.isNaN(received.getTime())) return null;
  return Math.floor((asOf.getTime() - received.getTime()) / 86_400_000);
}

export function ageBucket(age: number | null): AgeBucket {
  if (age === null || age < 0) return 'unknown';
  if (age <= 30) return '0-30';
  if (age <= 90) return '31-90';
  if (age <= 180) return '91-180';
  return 'over-180';
}

export interface AgingLot {
  remainingQty: number;
  receivedAt: string | null;
  unitCost: number | null;
}

export interface AgingSummary {
  oldestDays: number | null;
  weightedAverageDays: number | null;
  knownUnits: number;
  unknownUnits: number;
  knownValue: number | null;
  unknownCostUnits: number;
  buckets: Record<AgeBucket, { units: number; value: number | null }>;
}

const emptyBuckets = (): AgingSummary['buckets'] => ({
  '0-30': { units: 0, value: 0 },
  '31-90': { units: 0, value: 0 },
  '91-180': { units: 0, value: 0 },
  'over-180': { units: 0, value: 0 },
  unknown: { units: 0, value: null },
});

/**
 * Warehouse age only. Manufacturing DOT age is a different fact and is not read here.
 * Unknown receipt dates stay out of the known average and the known buckets.
 * A missing or zero unit cost is not treated as a known value.
 */
export function summarizeAging(lots: AgingLot[], asOf: Date): AgingSummary {
  const buckets = emptyBuckets();
  let knownUnits = 0;
  let unknownUnits = 0;
  let weighted = 0;
  let oldest: number | null = null;
  let knownValue = 0;
  let valuedUnits = 0;
  let unknownCostUnits = 0;
  for (const lot of lots) {
    const qty = Math.max(0, lot.remainingQty);
    if (qty === 0) continue;
    const age = ageDays(lot.receivedAt, asOf);
    const bucket = ageBucket(age);
    const costKnown = lot.unitCost !== null && lot.unitCost > 0;
    buckets[bucket].units += qty;
    if (bucket === 'unknown') {
      unknownUnits += qty;
      unknownCostUnits += costKnown ? 0 : qty;
      continue;
    }
    knownUnits += qty;
    weighted += age! * qty;
    oldest = oldest === null ? age! : Math.max(oldest, age!);
    if (!costKnown) {
      unknownCostUnits += qty;
      buckets[bucket].value = null;
      continue;
    }
    knownValue += lot.unitCost! * qty;
    valuedUnits += qty;
    if (buckets[bucket].value !== null) buckets[bucket].value += lot.unitCost! * qty;
  }
  return {
    oldestDays: oldest,
    weightedAverageDays: knownUnits > 0 ? weighted / knownUnits : null,
    knownUnits,
    unknownUnits,
    knownValue: valuedUnits > 0 ? knownValue : null,
    unknownCostUnits,
    buckets,
  };
}
