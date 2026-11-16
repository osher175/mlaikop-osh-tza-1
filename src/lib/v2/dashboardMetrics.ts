// Mlaiko V2 dashboard — pure, deterministic metric helpers. No sample data.
// Business rules: Asia/Jerusalem day boundaries; sale_total_ils is VAT-inclusive (18%);
// cost_snapshot_ils is the historical unit cost (ex-VAT). On older sale rows a
// missing or zero snapshot is unknown. A legacy_sale_request row sets cost_known
// so a stored 0 stays a real zero and null stays unknown.

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
  /**
   * Omitted on legacy inventory_actions. Those rows still treat a missing or zero
   * snapshot as unknown, because the current sale writer stores 0 when cost is missing.
   * New sale lines set this explicitly: true includes a genuine zero cost.
   */
  cost_known?: boolean;
}

export const ATOMIC_LEGACY_SALE_REFERENCE = 'legacy_sale_request';

/** Older rows keep the legacy rule. Atomic sale rows distinguish null from zero. */
export const atomicLegacyCostKnown = (
  referenceType: string | null | undefined,
  cost: number | null,
): boolean | undefined => (
  referenceType === ATOMIC_LEGACY_SALE_REFERENCE ? cost !== null : undefined
);

const hasCost = (r: SaleRow) => {
  if (r.sale_total_ils === null) return false;
  if (r.cost_known === false) return false;
  if (r.cost_known === true) return r.cost_snapshot_ils !== null;
  return r.cost_snapshot_ils !== null && r.cost_snapshot_ils > 0;
};
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

/** Same sale row as the dashboard, plus an explicit salesperson. Null means unattributed. */
export interface AttributedSaleRow extends SaleRow {
  salesperson_employee_id: string | null;
  /** Set for a multi-line sale so every line counts as one transaction. Legacy rows omit it. */
  transaction_id?: string | null;
  reference_type?: string | null;
  list_unit_ils?: number | null;
  discount_ils?: number | null;
  discount_percent?: number | null;
}

export interface EmployeePerformance {
  employeeId: string;
  revenueGross: number;
  grossProfit: number | null;
  marginPct: number | null;
  costCoveragePct: number | null;
  transactions: number;
  tiresSold: number;
  /** VAT-inclusive revenue divided by transaction count. Null when there are no transactions. */
  averageTransactionValue: number | null;
  /** Null when no sale in the group has a known cost. Those employees are not ranked. */
  rank: number | null;
}

export interface EmployeeProductStat {
  employeeId: string | null;
  productId: string;
  revenueGross: number;
  units: number;
}

export interface EmployeeDayStat {
  day: string;
  employeeId: string | null;
  revenueGross: number;
}

export interface EmployeeAnalytics {
  business: PeriodSummary;
  attributedRevenue: number;
  unattributedRevenue: number;
  unattributedTransactions: number;
  /** Share of VAT-inclusive business revenue that has a salesperson. Null when revenue is 0. */
  coveragePct: number | null;
  ranked: EmployeePerformance[];
  unranked: EmployeePerformance[];
  products: EmployeeProductStat[];
  daily: EmployeeDayStat[];
  /** attributedRevenue + unattributedRevenue equals business.revenueGross. */
  reconciles: boolean;
}

/**
 * Employee split of the same rows `summarize` uses.
 * Revenue is VAT-inclusive. Profit is ex-VAT and only over cost-known rows.
 * Missing salesperson stays unattributed. Unknown cost is never treated as zero
 * and does not receive a rank.
 */
export function employeeAnalytics(rows: AttributedSaleRow[]): EmployeeAnalytics {
  const business = summarize(rows);
  const map = new Map<string, { revenue: number; knownRev: number; knownProfit: number; known: number; units: number; txns: Set<string> }>();
  const products = new Map<string, EmployeeProductStat>();
  const daily = new Map<string, EmployeeDayStat>();
  const unattributedTxns = new Set<string>();
  let attributedRevenue = 0;
  let unattributedRevenue = 0;

  rows.forEach((r, index) => {
    if (r.sale_total_ils === null) return;
    const employeeId = r.salesperson_employee_id;
    const txnKey = r.transaction_id ? `t:${r.transaction_id}` : `r:${index}`;
    const units = Math.abs(r.quantity_changed);
    if (!employeeId) {
      unattributedRevenue += r.sale_total_ils;
      unattributedTxns.add(txnKey);
    } else {
      attributedRevenue += r.sale_total_ils;
      const e = map.get(employeeId) ?? { revenue: 0, knownRev: 0, knownProfit: 0, known: 0, units: 0, txns: new Set<string>() };
      e.revenue += r.sale_total_ils;
      e.units += units;
      e.txns.add(txnKey);
      if (hasCost(r)) {
        e.knownRev += r.sale_total_ils;
        e.knownProfit += rowProfit(r);
        e.known++;
      }
      map.set(employeeId, e);
    }

    const productKey = `${employeeId ?? ''}|${r.product_id}`;
    const product = products.get(productKey) ?? { employeeId, productId: r.product_id, revenueGross: 0, units: 0 };
    product.revenueGross += r.sale_total_ils;
    product.units += units;
    products.set(productKey, product);

    if (r.timestamp) {
      const day = businessDayKey(r.timestamp);
      const dayKey = `${day}|${employeeId ?? ''}`;
      const point = daily.get(dayKey) ?? { day, employeeId, revenueGross: 0 };
      point.revenueGross += r.sale_total_ils;
      daily.set(dayKey, point);
    }
  });

  const performances = [...map.entries()].map(([employeeId, e]): EmployeePerformance => {
    const knownNet = e.knownRev / (1 + VAT_RATE);
    const transactions = e.txns.size;
    const costCoveragePct = e.revenue > 0 ? (e.knownRev / e.revenue) * 100 : null;
    const costComplete = costCoveragePct !== null && costCoveragePct >= 99.95;
    return {
      employeeId,
      revenueGross: e.revenue,
      grossProfit: e.known ? e.knownProfit : null,
      marginPct: e.known && costComplete && knownNet > 0 ? (e.knownProfit / knownNet) * 100 : null,
      costCoveragePct,
      transactions,
      tiresSold: e.units,
      averageTransactionValue: transactions > 0 ? e.revenue / transactions : null,
      rank: null,
    };
  });

  const costComplete = (p: EmployeePerformance) => p.costCoveragePct !== null && p.costCoveragePct >= 99.95 && p.grossProfit !== null;
  const ranked = performances
    .filter(costComplete)
    .sort((a, b) => (b.grossProfit as number) - (a.grossProfit as number) || b.revenueGross - a.revenueGross || a.employeeId.localeCompare(b.employeeId));
  ranked.forEach((p, i) => { p.rank = i + 1; });
  const unranked = performances
    .filter((p) => !costComplete(p))
    .sort((a, b) => b.revenueGross - a.revenueGross || a.employeeId.localeCompare(b.employeeId));

  return {
    business,
    attributedRevenue,
    unattributedRevenue,
    unattributedTransactions: unattributedTxns.size,
    coveragePct: business.revenueGross > 0 ? (attributedRevenue / business.revenueGross) * 100 : null,
    ranked,
    unranked,
    products: [...products.values()].sort((a, b) => b.revenueGross - a.revenueGross),
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day) || (a.employeeId ?? '').localeCompare(b.employeeId ?? '')),
    reconciles: Math.abs(attributedRevenue + unattributedRevenue - business.revenueGross) < 0.01,
  };
}

export interface EmployeeInsight {
  title: string;
  employeeId: string;
  currentValue: number;
  previousValue: number | null;
}

/** Observations that can be checked against the same analytics object. No invented comparisons. */
export function employeeInsights(current: EmployeeAnalytics, previous: EmployeeAnalytics | null): EmployeeInsight[] {
  const people = [...current.ranked, ...current.unranked];
  if (people.length === 0) return [];
  const insights: EmployeeInsight[] = [];
  const byRevenue = [...people].sort((a, b) => b.revenueGross - a.revenueGross);
  const topRevenue = byRevenue[0];
  insights.push({ title: 'המחזור המשויך הגבוה', employeeId: topRevenue.employeeId, currentValue: topRevenue.revenueGross, previousValue: null });
  if (current.ranked[0]) {
    insights.push({ title: 'הרווח הגולמי הידוע הגבוה', employeeId: current.ranked[0].employeeId, currentValue: current.ranked[0].grossProfit as number, previousValue: null });
  }
  const marginLeader = [...current.ranked].filter((p) => p.marginPct !== null).sort((a, b) => (b.marginPct as number) - (a.marginPct as number))[0];
  if (marginLeader) insights.push({ title: 'שיעור הרווח הגבוה בין עובדים עם כיסוי עלות מלא', employeeId: marginLeader.employeeId, currentValue: marginLeader.marginPct as number, previousValue: null });
  if (previous) {
    for (const person of people) {
      const before = [...previous.ranked, ...previous.unranked].find((p) => p.employeeId === person.employeeId);
      if (!before || before.revenueGross <= 0) continue;
      const change = ((person.revenueGross - before.revenueGross) / before.revenueGross) * 100;
      if (Math.abs(change) >= 10) {
        insights.push({
          title: change > 0 ? 'עלייה במחזור מול התקופה הקודמת' : 'ירידה במחזור מול התקופה הקודמת',
          employeeId: person.employeeId,
          currentValue: person.revenueGross,
          previousValue: before.revenueGross,
        });
      }
      if (before.transactions > 0 && person.transactions !== before.transactions) {
        insights.push({
          title: 'שינוי במספר העסקאות',
          employeeId: person.employeeId,
          currentValue: person.transactions,
          previousValue: before.transactions,
        });
      }
    }
  }
  return insights;
}
