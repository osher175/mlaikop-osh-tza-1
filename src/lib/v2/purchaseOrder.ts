import { PURCHASE_ORDERS_READY } from '@/lib/v2/inventoryFlags';
import { clampReceiveQty, openQty } from '@/lib/v2/goodsReceipt';

/**
 * Agreed purchase prices are the amounts entered on the order.
 * The order total is their sum. VAT of 18% is not added and not removed here.
 * Null cost stays unknown. Zero stays zero.
 * A draft and a confirmed order do not increase stock.
 */

export type OrderStatus = 'draft' | 'awaiting_receipt' | 'partially_received' | 'completed' | 'cancelled';
export type CompletionKind = 'fully_received' | 'closed_unfulfilled' | null;

export interface OrderLineInput {
  key: string;
  productId: string | null;
  brand: string;
  model: string;
  sizeLabel: string;
  loadIndex: string;
  speedRating: string;
  quantity: number;
  unitCost: number | null;
  supplierSku: string | null;
  barcode?: string | null;
  description?: string | null;
}

export interface OrderLine extends OrderLineInput {
  receivedQty: number;
  agreedUnitCost: number | null;
}

export interface PurchaseOrder {
  id: string;
  number: string | null;
  status: OrderStatus;
  completion: CompletionKind;
  supplierId: string | null;
  orderingEmployeeId: string | null;
  orderedOn: string;
  lines: OrderLine[];
  closeReason: string | null;
}

export interface CatalogCandidate {
  id: string;
  barcode: string | null;
  brand: string;
  model: string;
  sizeLabel: string;
  loadIndex: string;
  speedRating: string;
}

const MONEY = /^\d+(\.\d{1,2})?$/;

/** Order drafts and confirmation. Physical receiving stays behind PURCHASE_RECEIPT_ATOMIC_READY. */
export function ordersWritable(): boolean {
  return PURCHASE_ORDERS_READY;
}

/** Ledger list and the post-save refresh share this key. */
export function purchaseOrdersQueryKey(businessId: string | null) {
  return ['purchase-orders', businessId] as const;
}

export function lineTotal(quantity: number, unitCost: number | null): number | null {
  if (!Number.isInteger(quantity) || quantity < 0) return null;
  if (unitCost === null) return null;
  if (!Number.isFinite(unitCost) || unitCost < 0) return null;
  return quantity * unitCost;
}

export function orderTotals(lines: Array<Pick<OrderLineInput, 'quantity' | 'unitCost'>>) {
  const units = lines.reduce((sum, line) => sum + (Number.isInteger(line.quantity) && line.quantity > 0 ? line.quantity : 0), 0);
  const missing = lines.some((line) => line.quantity > 0 && lineTotal(line.quantity, line.unitCost) === null);
  const amount = missing ? null : lines.reduce((sum, line) => sum + (lineTotal(line.quantity, line.unitCost) ?? 0), 0);
  return { lines: lines.length, units, amount };
}

export function moneyInputValid(raw: string): number | null | false {
  const text = raw.trim();
  if (!text) return null;
  if (!MONEY.test(text)) return false;
  return Number(text);
}

const filled = (value: string) => value.trim().length > 0;

export function lineReady(line: OrderLineInput, confirming: boolean): string | null {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) return 'הכמות חייבת להיות מספר שלם וחיובי.';
  if (line.unitCost !== null && (!Number.isFinite(line.unitCost) || line.unitCost < 0)) return 'עלות לא תקינה.';
  if (!line.productId && ![line.brand, line.model, line.sizeLabel, line.loadIndex, line.speedRating].every(filled)) {
    return 'מוצר חדש דורש מותג, דגם, מידה, עומס ומהירות. מותג ומידה לבדם אינם מספיקים.';
  }
  if (confirming && line.unitCost === null) return 'בקביעת הזמנה חסרה עלות מוסכמת. עלות לא ידועה אינה אפס.';
  return null;
}

export function draftProblems(input: { supplierId: string | null; employeeId: string | null; lines: OrderLineInput[] }): string[] {
  const problems: string[] = [];
  if (!input.supplierId) problems.push('חסר ספק.');
  if (!input.employeeId) problems.push('חסר העובד שהזמין.');
  if (input.lines.length === 0) problems.push('אין שורות.');
  input.lines.forEach((line) => {
    const problem = lineReady(line, false);
    if (problem) problems.push(problem);
  });
  return problems;
}

export function confirmProblems(input: { supplierId: string | null; employeeId: string | null; lines: OrderLineInput[] }): string[] {
  const problems: string[] = [];
  if (!input.supplierId) problems.push('חסר ספק.');
  if (!input.employeeId) problems.push('חסר העובד שהזמין.');
  if (input.lines.length === 0) problems.push('אין שורות.');
  input.lines.forEach((line) => {
    const problem = lineReady(line, true);
    if (problem) problems.push(problem);
  });
  return problems;
}

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  draft: ['awaiting_receipt', 'cancelled'],
  awaiting_receipt: ['partially_received', 'completed', 'cancelled'],
  partially_received: ['partially_received', 'completed'],
  completed: [],
  cancelled: [],
};

export function transitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

export function confirmOrder<T extends { id: string }>(
  saved: Map<string, T>,
  idempotencyKey: string,
  create: () => T,
): { order: T; replayed: boolean } {
  const existing = saved.get(idempotencyKey);
  if (existing) return { order: existing, replayed: true };
  const order = create();
  saved.set(idempotencyKey, order);
  return { order, replayed: false };
}

export function orderNumber(existing: string[]): string {
  const max = existing.reduce((highest, value) => {
    const match = /^PO-(\d+)$/.exec(value);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `PO-${max + 1}`;
}

export function statusAfterReceipt(lines: OrderLine[]): OrderStatus {
  const any = lines.some((line) => line.receivedQty > 0);
  const done = lines.length > 0 && lines.every((line) => line.receivedQty >= line.quantity);
  if (done) return 'completed';
  if (any) return 'partially_received';
  return 'awaiting_receipt';
}

export function receiveQuantities(lines: OrderLine[], requested: Array<{ key: string; quantity: number }>): OrderLine[] {
  return lines.map((line) => {
    const ask = requested.find((row) => row.key === line.key)?.quantity ?? 0;
    const open = openQty({ orderedQty: line.quantity, previouslyReceivedQty: line.receivedQty });
    const qty = clampReceiveQty(ask, open).qty;
    return { ...line, receivedQty: line.receivedQty + qty };
  });
}

export function closeUnfulfilled(order: PurchaseOrder, reason: string): PurchaseOrder | null {
  if (!transitionAllowed(order.status, 'completed')) return null;
  if (order.status === 'cancelled' || !reason.trim()) return null;
  if (order.lines.every((line) => line.receivedQty >= line.quantity)) return null;
  return { ...order, status: 'completed', completion: 'closed_unfulfilled', closeReason: reason.trim() };
}

export function cancelOrder(order: PurchaseOrder): PurchaseOrder | null {
  if (!transitionAllowed(order.status, 'cancelled')) return null;
  return { ...order, status: 'cancelled', completion: null };
}

export type ProductMatch =
  | { kind: 'existing'; productId: string }
  | { kind: 'ambiguous'; productIds: string[] }
  | { kind: 'create' }
  | { kind: 'insufficient' };

const sameIdentity = (line: OrderLineInput, candidate: CatalogCandidate) =>
  line.brand.trim().toLowerCase() === candidate.brand.trim().toLowerCase()
  && line.model.trim().toLowerCase() === candidate.model.trim().toLowerCase()
  && line.sizeLabel.trim().toLowerCase() === candidate.sizeLabel.trim().toLowerCase()
  && line.loadIndex.trim().toLowerCase() === candidate.loadIndex.trim().toLowerCase()
  && line.speedRating.trim().toLowerCase() === candidate.speedRating.trim().toLowerCase();

/** Brand and size alone never select a product. */
export function matchProduct(line: OrderLineInput, candidates: CatalogCandidate[]): ProductMatch {
  if (line.productId) return { kind: 'existing', productId: line.productId };
  const identity = candidates.filter((candidate) => sameIdentity(line, candidate));
  if (identity.length === 1) return { kind: 'existing', productId: identity[0].id };
  if (identity.length > 1) return { kind: 'ambiguous', productIds: identity.map((candidate) => candidate.id) };
  if (lineReady(line, false)) return { kind: 'insufficient' };
  return { kind: 'create' };
}

export function matchByBarcode(barcode: string, candidates: CatalogCandidate[]): ProductMatch {
  const hits = candidates.filter((candidate) => candidate.barcode === barcode);
  if (hits.length === 1) return { kind: 'existing', productId: hits[0].id };
  if (hits.length > 1) return { kind: 'ambiguous', productIds: hits.map((candidate) => candidate.id) };
  return { kind: 'insufficient' };
}

export function supplierSkuConflict(
  known: Array<{ sku: string; productId: string }>,
  sku: string,
  productId: string,
): boolean {
  return known.some((row) => row.sku === sku && row.productId !== productId);
}

export function costChange(agreed: number | null, actual: number | null, quantity: number) {
  if (agreed === null || actual === null || !Number.isInteger(quantity) || quantity < 0) {
    return { changed: agreed !== actual, perUnit: null, total: null };
  }
  const perUnit = actual - agreed;
  return { changed: perUnit !== 0, perUnit, total: perUnit * quantity };
}

export interface PostedReceipt { id: string; quantities: Record<string, number> }

/** A repeated receipt key returns the first receipt and does not add quantity again. */
export function postReceipt(
  posted: Map<string, PostedReceipt>,
  key: string,
  quantities: Record<string, number>,
): { receipt: PostedReceipt; replayed: boolean } {
  const existing = posted.get(key);
  if (existing) return { receipt: existing, replayed: true };
  const receipt = { id: key, quantities: { ...quantities } };
  posted.set(key, receipt);
  return { receipt, replayed: false };
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'טיוטה',
  awaiting_receipt: 'ממתינה לקליטה',
  partially_received: 'אספקה חלקית',
  completed: 'הושלמה',
  cancelled: 'בוטלה',
};

/** A draft, a completed order and a cancelled order are not open for receiving. */
export function canReceive(status: OrderStatus): boolean {
  return status === 'awaiting_receipt' || status === 'partially_received';
}

export function canCloseOpenBalance(status: OrderStatus): boolean {
  return status === 'partially_received';
}

export type OrderPeriod = 'all' | 'month' | 'days30' | 'year';

export interface ListedOrder {
  id: string;
  number: string | null;
  orderedOn: string;
  supplierName: string;
  employeeName: string;
  status: OrderStatus;
}

export function isOrderStatus(value: string): value is OrderStatus {
  return value === 'draft' || value === 'awaiting_receipt' || value === 'partially_received' || value === 'completed' || value === 'cancelled';
}

export function filterOrders<T extends ListedOrder>(orders: T[], search: string, status: OrderStatus | 'all', period: OrderPeriod, today: string): T[] {
  const term = search.trim().toLowerCase();
  return orders.filter((order) => {
    if (status !== 'all' && order.status !== status) return false;
    if (!inOrderPeriod(order.orderedOn, period, today)) return false;
    if (!term) return true;
    return [order.number, order.supplierName, order.employeeName].some((value) => (value ?? '').toLowerCase().includes(term));
  });
}

export function inOrderPeriod(orderedOn: string, period: OrderPeriod, today: string): boolean {
  const day = orderedOn.slice(0, 10);
  if (period === 'all') return true;
  if (period === 'month') return day.slice(0, 7) === today.slice(0, 7);
  if (period === 'year') return day.slice(0, 4) === today.slice(0, 4);
  const start = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  const value = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(value) && value <= start && start - value <= 30 * 86400000;
}

export const receiptSteps = [
  'authorize',
  'lock-balances',
  'resolve-product',
  'insert-receipt',
  'increase-stock',
  'insert-movement',
  'insert-fifo-lot',
  'update-order',
  'commit',
] as const;
