import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  confirmProblems, draftProblems, isOrderStatus, ordersWritable, type OrderLine, type OrderLineInput, type OrderStatus,
} from '@/lib/v2/purchaseOrder';
import { explainPurchaseOrderError, persistenceRefusal, type SaveOrderRequest } from '@/lib/v2/purchaseOrderSave';

export interface PersistedOrder {
  id: string;
  version: number;
  number: string | null;
  status: OrderStatus;
  supplierId: string | null;
  supplierName: string;
  orderingEmployeeId: string | null;
  employeeName: string;
  orderedOn: string;
  expectedOn: string | null;
  supplierReference: string | null;
  notes: string | null;
  lines: OrderLine[];
}

const refused = () => {
  throw new Error('ספר ההזמנות כבוי. ההזמנה לא נשמרה.');
};

const lineJson = (line: OrderLineInput): Json => ({
  product_id: line.productId,
  brand: line.brand,
  model: line.model,
  size_label: line.sizeLabel,
  load_index: line.loadIndex,
  speed_rating: line.speedRating,
  supplier_sku: line.supplierSku,
  quantity: line.quantity,
  agreed_unit_cost: line.unitCost,
  barcode: line.barcode ?? null,
  description: line.description ?? null,
});

const readSave = (value: Json): { id: string; replayed: boolean } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ההזמנה לא נשמרה. לא התקבל אישור מהשרת.');
  const id = value.id;
  const replayed = value.replayed;
  if (typeof id !== 'string' || typeof replayed !== 'boolean') throw new Error('ההזמנה לא נשמרה. לא התקבל אישור מהשרת.');
  return { id, replayed };
};

/** Refuses before any request while the order ledger flag is off. */
export async function savePurchaseOrder(request: SaveOrderRequest): Promise<{ id: string; replayed: boolean }> {
  const blocked = persistenceRefusal(ordersWritable());
  if (blocked) throw new Error(blocked);
  const problems = request.confirm
    ? confirmProblems({ supplierId: request.supplierId, employeeId: request.employeeId, lines: request.lines })
    : draftProblems({ supplierId: request.supplierId, employeeId: request.employeeId, lines: request.lines });
  if (problems.length > 0 || !request.supplierId || !request.employeeId) throw new Error(problems[0] ?? 'ההזמנה אינה שלמה.');
  const { data, error } = await supabase.rpc('save_purchase_order', {
    p_business_id: request.businessId,
    p_idempotency_key: request.idempotencyKey,
    p_confirm: request.confirm,
    p_supplier_id: request.supplierId,
    p_employee_id: request.employeeId,
    p_ordered_on: request.orderedOn,
    p_lines: request.lines.map(lineJson),
    p_order_id: request.orderId ?? undefined,
    p_expected_version: request.expectedVersion ?? undefined,
    p_expected_on: request.expectedOn ?? undefined,
    p_supplier_reference: request.supplierReference ?? undefined,
    p_notes: request.notes ?? undefined,
  });
  if (error) throw new Error(explainPurchaseOrderError(error.message));
  return readSave(data);
}

export async function listPurchaseOrders(businessId: string): Promise<PersistedOrder[]> {
  if (!ordersWritable()) refused();
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, order_number, status, version, ordered_on, expected_on, notes, supplier_reference, supplier_id, ordering_employee_id')
    .eq('business_id', businessId)
    .order('ordered_on', { ascending: false });
  if (error) throw error;
  const headers = data ?? [];
  const ids = headers.map((row) => row.id);
  const supplierIds = headers.flatMap((row) => (row.supplier_id ? [row.supplier_id] : []));
  const employeeIds = headers.flatMap((row) => (row.ordering_employee_id ? [row.ordering_employee_id] : []));
  const [lines, suppliers, employees] = await Promise.all([
    ids.length === 0 ? Promise.resolve({ data: [], error: null }) : supabase.from('purchase_order_lines').select('id, purchase_order_id, product_id, brand, model, size_label, load_index, speed_rating, supplier_sku, barcode, description, ordered_qty, received_qty, agreed_unit_cost').in('purchase_order_id', ids),
    supplierIds.length === 0 ? Promise.resolve({ data: [], error: null }) : supabase.from('suppliers').select('id, name').in('id', supplierIds),
    employeeIds.length === 0 ? Promise.resolve({ data: [], error: null }) : supabase.from('employees').select('id, display_name').in('id', employeeIds),
  ]);
  if (lines.error) throw lines.error;
  if (suppliers.error) throw suppliers.error;
  if (employees.error) throw employees.error;
  const supplierName = new Map((suppliers.data ?? []).map((row) => [row.id, row.name]));
  const employeeName = new Map((employees.data ?? []).map((row) => [row.id, row.display_name]));
  return headers.map((row) => {
    if (!isOrderStatus(row.status)) throw new Error('סטטוס הזמנה לא מוכר.');
    const orderLines: OrderLine[] = (lines.data ?? []).filter((line) => line.purchase_order_id === row.id).map((line) => ({
      key: line.id,
      productId: line.product_id,
      brand: line.brand ?? '',
      model: line.model ?? '',
      sizeLabel: line.size_label ?? '',
      loadIndex: line.load_index ?? '',
      speedRating: line.speed_rating ?? '',
      quantity: line.ordered_qty,
      unitCost: line.agreed_unit_cost,
      supplierSku: line.supplier_sku,
      barcode: line.barcode,
      description: line.description,
      receivedQty: line.received_qty,
      agreedUnitCost: line.agreed_unit_cost,
    }));
    return {
      id: row.id,
      version: row.version,
      number: row.order_number,
      status: row.status,
      supplierId: row.supplier_id,
      supplierName: (row.supplier_id && supplierName.get(row.supplier_id)) || 'ספק לא רשום',
      orderingEmployeeId: row.ordering_employee_id,
      employeeName: (row.ordering_employee_id && employeeName.get(row.ordering_employee_id)) || 'עובד לא רשום',
      orderedOn: row.ordered_on,
      expectedOn: row.expected_on,
      supplierReference: row.supplier_reference,
      notes: row.notes,
      lines: orderLines,
    };
  });
}
