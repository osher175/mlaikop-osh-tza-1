import {
  confirmProblems, draftProblems, orderNumber, type OrderLineInput, type OrderStatus,
} from '@/lib/v2/purchaseOrder';

/**
 * In-memory mirror of save_purchase_order.
 * A draft and a confirmation do not change stock, FIFO lots, or inventory movements.
 * Supplier prices stay as entered. VAT is not added or removed.
 */

export interface LedgerLine extends OrderLineInput {
  receivedQty: number;
}

export interface LedgerOrder {
  id: string;
  businessId: string;
  version: number;
  status: OrderStatus;
  supplierId: string | null;
  employeeId: string | null;
  orderedOn: string;
  expectedOn: string | null;
  supplierReference: string | null;
  notes: string | null;
  number: string | null;
  idempotencyKey: string;
  lastRequestKey: string;
  lines: LedgerLine[];
}

export interface OrderTenant {
  callerUserId: string | null;
  memberBusinessIds: string[];
  billingWritable: boolean;
  supplierIds: string[];
  activeEmployeeIds: string[];
  productIds: string[];
  nextOrderNumber: number;
  stock: Record<string, number>;
}

export interface SaveOrderRequest {
  businessId: string;
  idempotencyKey: string;
  confirm: boolean;
  orderId: string | null;
  expectedVersion: number | null;
  supplierId: string | null;
  employeeId: string | null;
  orderedOn: string;
  expectedOn: string | null;
  supplierReference: string | null;
  notes: string | null;
  lines: OrderLineInput[];
}

export type SaveFailure = 'denied' | 'invalid' | 'conflict' | 'immutable' | 'missing';

export interface SaveOrderResult {
  orders: LedgerOrder[];
  tenant: OrderTenant;
  outcome:
    | { ok: true; order: LedgerOrder; replayed: boolean }
    | { ok: false; reason: SaveFailure };
}

export function persistenceRefusal(ordersReady: boolean): string | null {
  if (!ordersReady) return 'ספר ההזמנות כבוי. ההזמנה לא נשמרה.';
  return null;
}

export function explainPurchaseOrderError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('ספר ההזמנות כבוי')) return message;
  if (text.includes('access denied') || text.includes('42501')) return 'אין הרשאה לשמור הזמנת רכש.';
  if (text.includes('version conflict')) return 'ההזמנה עודכנה במקום אחר. פתחו אותה מחדש לפני שמירה.';
  if (text.includes('not a draft') || text.includes('cannot be edited')) return 'הזמנה שסוכמה אינה נפתחת לעריכה.';
  if (text.includes('unknown cost')) return 'בקביעת הזמנה חסרה עלות מוסכמת. עלות לא ידועה אינה אפס.';
  if (text.includes('supplier not found')) return 'הספק אינו שייך לעסק הזה.';
  if (text.includes('employee not found')) return 'העובד אינו פעיל בעסק הזה.';
  if (text.includes('product not found')) return 'המוצר אינו שייך לעסק הזה.';
  if (text.includes('invalid quantity')) return 'הכמות חייבת להיות מספר שלם וחיובי.';
  if (text.includes('invalid cost')) return 'עלות לא תקינה.';
  if (text.includes('order not found')) return 'ההזמנה לא נמצאה בעסק הזה.';
  if (text.includes('incomplete') || text.includes('new specification')) return 'ההזמנה אינה שלמה.';
  return 'ההזמנה לא נשמרה. הנתונים בטופס נשארו.';
}

const problemsFor = (request: SaveOrderRequest): string[] => {
  const input = { supplierId: request.supplierId, employeeId: request.employeeId, lines: request.lines };
  return request.confirm ? confirmProblems(input) : draftProblems(input);
};

const tenantProblem = (request: SaveOrderRequest, tenant: OrderTenant): boolean => {
  if (!request.supplierId || !tenant.supplierIds.includes(request.supplierId)) return true;
  if (!request.employeeId || !tenant.activeEmployeeIds.includes(request.employeeId)) return true;
  return request.lines.some((line) => line.productId !== null && !tenant.productIds.includes(line.productId));
};

const toLines = (lines: OrderLineInput[]): LedgerLine[] => lines.map((line) => ({ ...line, receivedQty: 0 }));

const unchanged = (orders: LedgerOrder[], tenant: OrderTenant, reason: SaveFailure): SaveOrderResult => ({
  orders, tenant, outcome: { ok: false, reason },
});

/** Applies one save. The stock map is the same object, with the same quantities. */
export function applyPurchaseOrderSave(
  orders: LedgerOrder[],
  request: SaveOrderRequest,
  tenant: OrderTenant,
): SaveOrderResult {
  if (tenant.callerUserId === null || !tenant.memberBusinessIds.includes(request.businessId) || !tenant.billingWritable) {
    return unchanged(orders, tenant, 'denied');
  }
  const mine = orders.filter((order) => order.businessId === request.businessId);

  if (!request.orderId) {
    const existing = mine.find((order) => order.idempotencyKey === request.idempotencyKey);
    if (existing) return { orders, tenant, outcome: { ok: true, order: existing, replayed: true } };
    if (problemsFor(request).length > 0 || tenantProblem(request, tenant)) return unchanged(orders, tenant, 'invalid');
    const created = build(request, `order-${orders.length + 1}`, 1, request.idempotencyKey, assignedNumber(mine, request, null));
    return {
      orders: [...orders, created],
      tenant: afterNumber(tenant, request.confirm),
      outcome: { ok: true, order: created, replayed: false },
    };
  }

  const current = mine.find((order) => order.id === request.orderId);
  if (!current) return unchanged(orders, tenant, 'missing');
  if (current.lastRequestKey === request.idempotencyKey || current.idempotencyKey === request.idempotencyKey) {
    return { orders, tenant, outcome: { ok: true, order: current, replayed: true } };
  }
  if (current.status !== 'draft') return unchanged(orders, tenant, 'immutable');
  if (current.version !== request.expectedVersion) return unchanged(orders, tenant, 'conflict');
  if (current.lines.some((line) => line.receivedQty > 0)) return unchanged(orders, tenant, 'immutable');
  if (problemsFor(request).length > 0 || tenantProblem(request, tenant)) return unchanged(orders, tenant, 'invalid');

  const updated = build(
    request,
    current.id,
    current.version + 1,
    current.idempotencyKey,
    assignedNumber(mine, request, current.number),
  );
  return {
    orders: orders.map((order) => (order.id === current.id ? updated : order)),
    tenant: current.number ? tenant : afterNumber(tenant, request.confirm),
    outcome: { ok: true, order: updated, replayed: false },
  };
}

const assignedNumber = (orders: LedgerOrder[], request: SaveOrderRequest, existing: string | null): string | null => {
  if (!request.confirm) return existing;
  if (existing) return existing;
  return orderNumber(orders.flatMap((order) => (order.number ? [order.number] : [])));
};

const afterNumber = (tenant: OrderTenant, confirm: boolean): OrderTenant => (
  confirm ? { ...tenant, nextOrderNumber: tenant.nextOrderNumber + 1, stock: tenant.stock } : tenant
);

function build(
  request: SaveOrderRequest,
  id: string,
  version: number,
  creationKey: string,
  number: string | null,
): LedgerOrder {
  return {
    id,
    businessId: request.businessId,
    version,
    status: request.confirm ? 'awaiting_receipt' : 'draft',
    supplierId: request.supplierId,
    employeeId: request.employeeId,
    orderedOn: request.orderedOn,
    expectedOn: request.expectedOn,
    supplierReference: request.supplierReference,
    notes: request.notes,
    number,
    idempotencyKey: creationKey,
    lastRequestKey: request.idempotencyKey,
    lines: toLines(request.lines),
  };
}
