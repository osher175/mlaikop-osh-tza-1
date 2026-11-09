// Mlaiko V2 dashboard — pure, deterministic metric helpers. No sample data.
// Business rules: Asia/Jerusalem day boundaries; sale_total_ils is VAT-inclusive (18%);
// cost_snapshot_ils is the historical unit cost (ex-VAT). Missing/zero cost = UNKNOWN, never 0.

export const BUSINESS_TZ = 'Asia/Jerusalem';
export const VAT_RATE = 0.18;
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** YYYY-MM-DD in business time. */
export const businessDayKey = (d: Date | string) => dayFmt.format(typeof d === 'string' ? new Date(d) : d);

const tzOffsetMs = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - date.getTime();
};

/** UTC instant of 00:00 business time on the given YYYY-MM-DD. */
export const businessMidnightUtc = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - tzOffsetMs(new Date(guess)));
};

export const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export const daysBetweenInclusive = (from: string, to: string) =>
  Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) -
    Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86400000) + 1;

export const isValidDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export interface DayRange { from: string; to: string }

export const defaultRange = (now = new Date()): DayRange => {
  const today = businessDayKey(now);
  return { from: today.slice(0, 8) + '01', to: today };
};

export const resolveRange = (from: string | null, to: string | null, now = new Date()): DayRange => {
  if (isValidDay(from) && isValidDay(to) && from <= to) return { from, to };
  return defaultRange(now);
};

/** Previous comparable period of equal length, immediately before. */
export const previousRange = (r: DayRange): DayRange => {
  const len = daysBetweenInclusive(r.from, r.to);
  return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
};

/** [start, endExclusive) UTC instants. */
export const rangeToUtc = (r: DayRange) => ({
  start: businessMidnightUtc(r.from).toISOString(),
  endExclusive: businessMidnightUtc(addDays(r.to, 1)).toISOString(),
});

export const formatDayHe = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

export interface SaleRow {
  timestamp: string | null;
  product_id: string;
  quantity_changed: number;
  sale_total_ils: number | null;
  cost_snapshot_ils: number | null;
}

const hasCost = (r: SaleRow) => r.sale_total_ils !== null && r.cost_snapshot_ils !== null && r.cost_snapshot_ils > 0;
const rowProfit = (r: SaleRow) => (r.sale_total_ils as number) / (1 + VAT_RATE) - (r.cost_snapshot_ils as number) * Math.abs(r.quantity_changed);

export interface PeriodSummary {
  revenueGross: number;          // VAT-inclusive, rows with a recorded sale amount
  rowsWithoutRevenue: number;
  units: number;
  saleCount: number;
  grossProfit: number | null;    // ex-VAT revenue − historical cost, only rows with known cost
  marginPct: number | null;      // grossProfit / ex-VAT revenue of the same rows
  costCoveragePct: number | null; // share of VAT-incl revenue with known cost
}

export function summarize(rows: SaleRow[]): PeriodSummary {
  let revenueGross = 0, units = 0, rowsWithoutRevenue = 0, knownRev = 0, knownProfit = 0, knownCount = 0;
  for (const r of rows) {
    units += Math.abs(r.quantity_changed);
    if (r.sale_total_ils === null) { rowsWithoutRevenue++; continue; }
    revenueGross += r.sale_total_ils;
    if (hasCost(r)) { knownRev += r.sale_total_ils; knownProfit += rowProfit(r); knownCount++; }
  }
  const knownNet = knownRev / (1 + VAT_RATE);
  return {
    revenueGross, rowsWithoutRevenue, units, saleCount: rows.length,
    grossProfit: knownCount ? knownProfit : null,
    marginPct: knownCount && knownNet > 0 ? (knownProfit / knownNet) * 100 : null,
    costCoveragePct: revenueGross > 0 ? (knownRev / revenueGross) * 100 : null,
  };
}

export interface DailyPoint { day: string; revenue: number; profit: number | null; complete: boolean }

/** Every day in range present (zero revenue on empty days). Profit null when no cost-known sale that day. */
export function dailySeries(rows: SaleRow[], range: DayRange): DailyPoint[] {
  const map = new Map<string, { revenue: number; profit: number; known: number; unknown: number }>();
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) map.set(d, { revenue: 0, profit: 0, known: 0, unknown: 0 });
  for (const r of rows) {
    if (!r.timestamp || r.sale_total_ils === null) continue;
    const e = map.get(businessDayKey(r.timestamp));
    if (!e) continue;
    e.revenue += r.sale_total_ils;
    if (hasCost(r)) { e.profit += rowProfit(r); e.known++; } else e.unknown++;
  }
  return [...map.entries()].map(([day, e]) => ({
    day, revenue: e.revenue,
    profit: e.known ? e.profit : e.unknown ? null : 0,
    complete: e.unknown === 0,
  }));
}

export interface ProductProfit { product_id: string; units: number; profit: number; unknownCostUnits: number }

/** Ranked only by known profit; products whose every sale lacks cost are excluded and counted. */
export function topProductsByProfit(rows: SaleRow[], limit = 5) {
  const map = new Map<string, ProductProfit & { known: number }>();
  for (const r of rows) {
    const e = map.get(r.product_id) ?? { product_id: r.product_id, units: 0, profit: 0, unknownCostUnits: 0, known: 0 };
    e.units += Math.abs(r.quantity_changed);
    if (hasCost(r)) { e.profit += rowProfit(r); e.known++; } else e.unknownCostUnits += Math.abs(r.quantity_changed);
    map.set(r.product_id, e);
  }
  const all = [...map.values()];
  const ranked = all.filter((p) => p.known > 0).sort((a, b) => b.profit - a.profit).slice(0, limit);
  return { ranked, excludedUnknown: all.filter((p) => p.known === 0).length };
}

export const pctChange = (cur: number | null, prev: number | null) =>
  cur === null || prev === null || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;
