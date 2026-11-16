import { PURCHASE_ORDERS_READY, PURCHASE_RECEIPT_ATOMIC_READY } from '@/lib/v2/inventoryFlags';

/**
 * Purchase unit costs are the stored purchase prices.
 * A null cost stays unknown. A stored 0 is a real zero.
 * Totals are not converted to or from VAT here.
 * A purchase order and a draft do not increase stock.
 */

export type ReceivingStatus = 'open' | 'partial' | 'received' | 'closed_unfulfilled';
export type ReceivingMode = 'partial' | 'full';

export interface ReceiptLine {
  id: string;
  productName: string;
  specification: string | null;
  orderedQty: number;
  previouslyReceivedQty: number;
  unitCost: number | null;
  selected: boolean;
  receiveQty: number;
}

export interface PurchaseOrderView {
  id: string;
  number: string | null;
  orderedOn: string | null;
  supplierName: string | null;
  status: ReceivingStatus;
  lines: ReceiptLine[];
}

export interface ReceiptDraft {
  orderId: string;
  mode: ReceivingMode;
  note: string;
  updateCurrentCost: boolean;
  lines: Array<{ id: string; selected: boolean; receiveQty: number }>;
  posted: false;
}

const whole = (value: number) => Number.isInteger(value) && value >= 0;

export function openQty(line: Pick<ReceiptLine, 'orderedQty' | 'previouslyReceivedQty'>): number {
  if (!whole(line.orderedQty) || !whole(line.previouslyReceivedQty)) return 0;
  return Math.max(0, line.orderedQty - line.previouslyReceivedQty);
}

export function clampReceiveQty(quantity: number, open: number): { qty: number; message: string | null } {
  if (!Number.isInteger(quantity) || quantity < 0) return { qty: 0, message: 'הכמות חייבת להיות מספר שלם ואינה יכולה להיות שלילית.' };
  if (quantity > open) return { qty: open, message: 'אי אפשר לקלוט יותר מהיתרה הפתוחה.' };
  return { qty: quantity, message: null };
}

/** An unchecked line is never received, even when a quantity was typed. */
export function quantityToReceive(line: ReceiptLine): number {
  if (!line.selected) return 0;
  return clampReceiveQty(line.receiveQty, openQty(line)).qty;
}

export function lineCost(line: ReceiptLine): number | null {
  const qty = quantityToReceive(line);
  if (qty === 0) return 0;
  if (line.unitCost === null || !Number.isFinite(line.unitCost) || line.unitCost < 0) return null;
  return qty * line.unitCost;
}

function sumCost(rows: Array<{ qty: number; unitCost: number | null }>): number | null {
  if (rows.some((row) => row.qty > 0 && (row.unitCost === null || !Number.isFinite(row.unitCost) || row.unitCost < 0))) return null;
  return rows.reduce((sum, row) => sum + row.qty * (row.unitCost ?? 0), 0);
}

export interface ReceiptSummary {
  selectedLines: number;
  quantity: number;
  currentCost: number | null;
  orderCost: number | null;
  previouslyReceivedCost: number | null;
  remainingCost: number | null;
}

export function summarizeReceipt(lines: ReceiptLine[]): ReceiptSummary {
  const active = lines.filter((line) => quantityToReceive(line) > 0);
  return {
    selectedLines: active.length,
    quantity: active.reduce((sum, line) => sum + quantityToReceive(line), 0),
    currentCost: sumCost(lines.map((line) => ({ qty: quantityToReceive(line), unitCost: line.unitCost }))),
    orderCost: sumCost(lines.map((line) => ({ qty: line.orderedQty, unitCost: line.unitCost }))),
    previouslyReceivedCost: sumCost(lines.map((line) => ({ qty: line.previouslyReceivedQty, unitCost: line.unitCost }))),
    remainingCost: sumCost(lines.map((line) => ({ qty: openQty(line), unitCost: line.unitCost }))),
  };
}

/** Full receiving takes the open balance, never the original ordered quantity. */
export function applyMode(lines: ReceiptLine[], mode: ReceivingMode): ReceiptLine[] {
  if (mode === 'partial') return lines.map((line) => ({ ...line, receiveQty: clampReceiveQty(line.receiveQty, openQty(line)).qty }));
  return lines.map((line) => {
    const open = openQty(line);
    return { ...line, selected: open > 0, receiveQty: open };
  });
}

export function setLineQty(lines: ReceiptLine[], id: string, quantity: number): { lines: ReceiptLine[]; message: string | null } {
  let message: string | null = null;
  const next = lines.map((line) => {
    if (line.id !== id) return line;
    if (!line.selected) return { ...line, receiveQty: 0 };
    const clamped = clampReceiveQty(quantity, openQty(line));
    message = clamped.message;
    return { ...line, receiveQty: clamped.qty };
  });
  return { lines: next, message };
}

export function setLineSelected(lines: ReceiptLine[], id: string, selected: boolean): ReceiptLine[] {
  return lines.map((line) => line.id === id ? { ...line, selected, receiveQty: selected ? line.receiveQty : 0 } : line);
}

export function receivingStatus(lines: ReceiptLine[], closed: boolean): ReceivingStatus {
  if (closed) return 'closed_unfulfilled';
  const anyReceived = lines.some((line) => line.previouslyReceivedQty > 0);
  const allDone = lines.length > 0 && lines.every((line) => line.previouslyReceivedQty >= line.orderedQty);
  if (allDone) return 'received';
  if (anyReceived) return 'partial';
  return 'open';
}

/** Records one delivery against the order. It does not change warehouse stock. */
export function applyDelivery(order: PurchaseOrderView, lines: ReceiptLine[]): PurchaseOrderView {
  const nextLines = order.lines.map((line) => {
    const draft = lines.find((row) => row.id === line.id) ?? line;
    const qty = quantityToReceive(draft);
    return {
      ...line,
      previouslyReceivedQty: line.previouslyReceivedQty + qty,
      selected: false,
      receiveQty: 0,
    };
  });
  return { ...order, lines: nextLines, status: receivingStatus(nextLines, false) };
}

/** Closes the open balance without receiving it and without increasing stock. */
export function closeUnfulfilled(order: PurchaseOrderView): PurchaseOrderView {
  if (order.status === 'received') return order;
  return { ...order, status: 'closed_unfulfilled', lines: order.lines.map((line) => ({ ...line, selected: false, receiveQty: 0 })) };
}

export function receiptPostingAvailable(): boolean {
  return PURCHASE_ORDERS_READY && PURCHASE_RECEIPT_ATOMIC_READY;
}

export function beginSubmit(pending: boolean): boolean {
  return !pending;
}

export function toDraft(orderId: string, mode: ReceivingMode, note: string, updateCurrentCost: boolean, lines: ReceiptLine[]): ReceiptDraft {
  return {
    orderId,
    mode,
    note,
    updateCurrentCost,
    lines: lines.map((line) => ({ id: line.id, selected: line.selected, receiveQty: line.receiveQty })),
    posted: false,
  };
}
