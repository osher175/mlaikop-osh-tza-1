/**
 * Import dashboard figures. Every total is computed here so the screens
 * cannot invent a progress percent or mix currencies.
 *
 * Inclusion:
 * - Active order: logistics status is not `completed` and not `cancelled`.
 * - Tire quantity: `ordered_quantity` of non-cancelled lines on those orders.
 * - Order value: quantity × supplier unit cost, in the order currency.
 *   A line with no cost, or a line currency that differs from the order,
 *   makes that order's value unknown. Unknown is never stored as zero,
 *   and currencies are never added together.
 * - Supplier paid: payments with status `paid`, no linked import cost,
 *   type deposit / balance / partial / supplier_payment, and the same
 *   currency as the order. Freight, customs and broker payments stay out.
 *   The percent is paid ÷ order value, and only when the value is known
 *   and greater than zero.
 * - Approaching receipt: an active order whose expected arrival is today
 *   or within the next 7 days. A missing date is not approaching.
 * - Delay: expected arrival is before today, and the persisted status is
 *   still before arrival in Israel (`ordered`, `preparing`, `shipped`,
 *   `in_transit`). A missing date is not a delay.
 */

export const RECEIPT_HORIZON_DAYS = 7;

export const SUPPLIER_PAYMENT_TYPES = ['deposit', 'balance', 'partial', 'supplier_payment'] as const;

const ACTIVE_EXCLUDED = new Set(['completed', 'cancelled']);
const BEFORE_ISRAEL = new Set(['ordered', 'preparing', 'shipped', 'in_transit']);

export interface DashboardOrder {
  id: string;
  importNumber: string;
  status: string;
  currencyCode: string;
  orderDate: string;
  estimatedArrival: string | null;
  actualArrival: string | null;
  commercialStatus: string | null;
  supplierId: string | null;
  supplierName: string;
  supplierReference: string | null;
}

export interface DashboardItem {
  orderId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number | null;
  currencyCode: string | null;
  description: string;
  sku: string | null;
  brandName: string | null;
  itemStatus: string;
}

export interface DashboardPayment {
  orderId: string;
  amount: number;
  currencyCode: string;
  paymentStatus: string;
  paymentType: string;
  importCostId: string | null;
}

export interface OrderCardModel {
  order: DashboardOrder;
  tireQuantity: number;
  receivedQuantity: number;
  goodsAmount: number | null;
  paidAmount: number;
  paymentPercent: number | null;
  delayed: boolean;
  approaching: boolean;
  searchText: string;
  brands: string[];
}

export interface CurrencyTotal {
  currency: string;
  amount: number;
  orders: number;
  incomplete: boolean;
}

export interface PaidTotal {
  currency: string;
  paid: number;
  goods: number;
  percent: number | null;
  incomplete: boolean;
}

export interface ImportKpis {
  activeOrders: number;
  tireQuantity: number;
  valueByCurrency: CurrencyTotal[];
  paidByCurrency: PaidTotal[];
  approachingReceipt: number;
}

export type DashboardView = 'loading' | 'error' | 'empty' | 'filtered-empty' | 'ready';

/** A failed query is never reported as an empty business. */
export function dashboardView(input: {
  isLoading: boolean;
  isError: boolean;
  orderCount: number;
  visibleCount: number;
}): DashboardView {
  if (input.isLoading) return 'loading';
  if (input.isError) return 'error';
  if (input.orderCount === 0) return 'empty';
  if (input.visibleCount === 0) return 'filtered-empty';
  return 'ready';
}

export type OrderDetailView = 'loading' | 'error' | 'missing' | 'ready';

/** An unknown id and a failed read stay different. Neither one invents an order. */
export function orderDetailView(input: {
  isLoading: boolean;
  isError: boolean;
  hasOrder: boolean;
}): OrderDetailView {
  if (input.isLoading) return 'loading';
  if (input.isError) return 'error';
  if (!input.hasOrder) return 'missing';
  return 'ready';
}

export type DashboardPeriod = 'all' | '30' | '90' | 'year';

export interface DashboardFilters {
  search: string;
  status: string;
  supplierId: string;
  period: DashboardPeriod;
}

export const LOGISTICS_STAGES = [
  { key: 'ordered', label: 'הוזמן', statuses: ['ordered'] },
  { key: 'preparing', label: 'בהכנה', statuses: ['preparing'] },
  { key: 'transit', label: 'בדרך', statuses: ['shipped', 'in_transit'] },
  { key: 'port', label: 'בנמל', statuses: ['arrived_israel'] },
  { key: 'customs', label: 'במכס', statuses: ['customs_clearance'] },
  { key: 'haul', label: 'הובלה', statuses: ['receiving'] },
  { key: 'warehouse', label: 'במחסן', statuses: ['received_pending_costs'] },
  { key: 'closed', label: 'נסגר', statuses: ['completed'] },
] as const;

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addIsoDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

export function isActiveStatus(status: string): boolean {
  return !ACTIVE_EXCLUDED.has(status);
}

export function logisticsStageIndex(status: string): number {
  return LOGISTICS_STAGES.findIndex((stage) => (stage.statuses as readonly string[]).includes(status));
}

/** Stage name and count. This is not a percentage of the logistics index. */
export function stageProgressLabel(status: string): string {
  if (status === 'cancelled') return 'בוטל';
  const index = logisticsStageIndex(status);
  if (index < 0) return 'מצב לא מוגדר';
  const stage = LOGISTICS_STAGES[index];
  return `${stage.label} · ${index + 1} מתוך ${LOGISTICS_STAGES.length}`;
}

export function isDelayed(order: DashboardOrder, today: string): boolean {
  return isActiveStatus(order.status)
    && !!order.estimatedArrival
    && order.estimatedArrival < today
    && BEFORE_ISRAEL.has(order.status);
}

export function isApproaching(order: DashboardOrder, today: string): boolean {
  if (!isActiveStatus(order.status) || !order.estimatedArrival) return false;
  const horizon = addIsoDays(today, RECEIPT_HORIZON_DAYS);
  return order.estimatedArrival >= today && order.estimatedArrival <= horizon;
}

/** Legacy receiving stays available only after the order is at the warehouse, or when a receipt was already recorded. */
export function canOpenLegacyReceiving(status: string, receivedQuantity: number): boolean {
  if (status === 'cancelled' || status === 'completed') return false;
  if (status === 'received_pending_costs') return true;
  return receivedQuantity > 0;
}

function finiteOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function supplierPaid(order: DashboardOrder, payments: DashboardPayment[]): number {
  return payments.reduce((sum, payment) => {
    if (payment.orderId !== order.id) return sum;
    if (payment.paymentStatus !== 'paid') return sum;
    if (payment.importCostId) return sum;
    if (!(SUPPLIER_PAYMENT_TYPES as readonly string[]).includes(payment.paymentType)) return sum;
    if (payment.currencyCode !== order.currencyCode) return sum;
    return sum + payment.amount;
  }, 0);
}

export function buildOrderCard(
  order: DashboardOrder,
  items: DashboardItem[],
  payments: DashboardPayment[],
  today: string,
): OrderCardModel {
  const lines = items.filter((item) => item.orderId === order.id && item.itemStatus !== 'cancelled');
  let tireQuantity = 0;
  let receivedQuantity = 0;
  let goods = 0;
  let goodsKnown = true;
  const brands = new Set<string>();
  const searchBits = [order.importNumber, order.supplierName, order.supplierReference ?? ''];

  for (const line of lines) {
    tireQuantity += line.orderedQuantity;
    receivedQuantity += line.receivedQuantity;
    if (line.brandName) brands.add(line.brandName);
    searchBits.push(line.description, line.sku ?? '', line.brandName ?? '');
    const currencyMismatch = !!line.currencyCode && line.currencyCode !== order.currencyCode;
    if (line.unitCost == null || currencyMismatch) goodsKnown = false;
    else goods += line.orderedQuantity * line.unitCost;
  }

  const goodsAmount = lines.length === 0 || !goodsKnown ? null : goods;
  const paidAmount = supplierPaid(order, payments);
  const paymentPercent = goodsAmount != null && goodsAmount > 0
    ? Math.round((paidAmount / goodsAmount) * 100)
    : null;

  return {
    order,
    tireQuantity,
    receivedQuantity,
    goodsAmount,
    paidAmount,
    paymentPercent,
    delayed: isDelayed(order, today),
    approaching: isApproaching(order, today),
    searchText: searchBits.join(' ').toLowerCase(),
    brands: [...brands],
  };
}

export function filterCards(cards: OrderCardModel[], filters: DashboardFilters, today: string): OrderCardModel[] {
  const needle = filters.search.trim().toLowerCase();
  const from = periodStart(filters.period, today);
  return cards.filter((card) => {
    if (filters.status && card.order.status !== filters.status) return false;
    if (filters.supplierId && card.order.supplierId !== filters.supplierId) return false;
    if (from && card.order.orderDate < from) return false;
    if (needle && !card.searchText.includes(needle)) return false;
    return true;
  });
}

function periodStart(period: DashboardPeriod, today: string): string | null {
  if (period === '30') return addIsoDays(today, -30);
  if (period === '90') return addIsoDays(today, -90);
  if (period === 'year') return `${today.slice(0, 4)}-01-01`;
  return null;
}

export function summarizeKpis(cards: OrderCardModel[]): ImportKpis {
  const active = cards.filter((card) => isActiveStatus(card.order.status));
  const valueMap = new Map<string, CurrencyTotal>();
  const paidMap = new Map<string, PaidTotal>();

  for (const card of active) {
    const currency = card.order.currencyCode || '—';
    const value = valueMap.get(currency) ?? { currency, amount: 0, orders: 0, incomplete: false };
    value.orders += 1;
    if (card.goodsAmount == null) value.incomplete = true;
    else value.amount += card.goodsAmount;
    valueMap.set(currency, value);

    const paid = paidMap.get(currency) ?? { currency, paid: 0, goods: 0, percent: null, incomplete: false };
    paid.paid += card.paidAmount;
    if (card.goodsAmount == null) paid.incomplete = true;
    else paid.goods += card.goodsAmount;
    paidMap.set(currency, paid);
  }

  const paidByCurrency = [...paidMap.values()].map((row) => ({
    ...row,
    percent: !row.incomplete && row.goods > 0 ? Math.round((row.paid / row.goods) * 100) : null,
  }));

  return {
    activeOrders: active.length,
    tireQuantity: active.reduce((sum, card) => sum + card.tireQuantity, 0),
    valueByCurrency: [...valueMap.values()],
    paidByCurrency,
    approachingReceipt: active.filter((card) => card.approaching).length,
  };
}

export function mapOrderRow(row: {
  id: string;
  import_number: string;
  status: string;
  currency_code: string;
  order_date: string;
  estimated_arrival_date: string | null;
  supplier_id: string | null;
  suppliers?: { name?: string | null } | { name?: string | null }[] | null;
  commercial_status?: string | null;
  actual_arrival_on?: string | null;
}): DashboardOrder {
  const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
  return {
    id: row.id,
    importNumber: row.import_number,
    status: row.status,
    currencyCode: row.currency_code || 'ILS',
    orderDate: String(row.order_date).slice(0, 10),
    estimatedArrival: row.estimated_arrival_date ? String(row.estimated_arrival_date).slice(0, 10) : null,
    actualArrival: row.actual_arrival_on ? String(row.actual_arrival_on).slice(0, 10) : null,
    commercialStatus: row.commercial_status ?? null,
    supplierId: row.supplier_id,
    supplierName: supplier?.name || 'ספק לא צוין',
    supplierReference: (row as { supplier_order_reference?: string | null }).supplier_order_reference ?? null,
  };
}

export function mapItemRow(row: {
  import_order_id: string;
  ordered_quantity: number | null;
  received_quantity?: number | null;
  supplier_unit_cost: number | null;
  currency_code?: string | null;
  product_description?: string | null;
  supplier_sku?: string | null;
  item_status?: string | null;
  brands?: { name?: string | null } | { name?: string | null }[] | null;
}): DashboardItem {
  const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
  return {
    orderId: row.import_order_id,
    orderedQuantity: Number(row.ordered_quantity ?? 0),
    receivedQuantity: Number(row.received_quantity ?? 0),
    unitCost: finiteOrNull(row.supplier_unit_cost),
    currencyCode: row.currency_code ?? null,
    description: row.product_description ?? '',
    sku: row.supplier_sku ?? null,
    brandName: brand?.name ?? null,
    itemStatus: row.item_status ?? 'ordered',
  };
}

export function mapPaymentRow(row: {
  import_order_id: string;
  amount: number | null;
  currency_code: string;
  payment_status: string;
  payment_type: string;
  import_cost_id?: string | null;
}): DashboardPayment {
  return {
    orderId: row.import_order_id,
    amount: Number(row.amount ?? 0),
    currencyCode: row.currency_code,
    paymentStatus: row.payment_status,
    paymentType: row.payment_type,
    importCostId: row.import_cost_id ?? null,
  };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString('he-IL')} ${currency}`;
  }
}

export function commercialLabel(status: string | null): string {
  if (status === 'draft') return 'טיוטה';
  if (status === 'confirmed') return 'מאושר';
  return 'לא סווג';
}
