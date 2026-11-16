/**
 * Pure FIFO allocation. The database function in
 * docs/v2/fifo-inventory-lots.UNAPPLIED.sql is the transactional copy.
 * This module does not write stock and does not change the live COGS method.
 */

export interface FifoLot {
  id: string;
  productId: string;
  receivedAt: string | null;
  remainingQty: number;
  unitCost: number | null;
  source: 'purchase_receipt' | 'customer_return_restock' | 'adjustment_increase' | 'opening_unknown' | 'transfer_in';
}

export interface FifoAllocation {
  lotId: string;
  quantity: number;
  unitCost: number | null;
}

export interface FifoState {
  lots: FifoLot[];
  /** idempotency key -> allocations already committed */
  exits: Map<string, FifoAllocation[]>;
}

export interface FifoResult {
  ok: boolean;
  reason?: 'short' | 'replay' | 'unsupported';
  allocations: FifoAllocation[];
  state: FifoState;
}

const clone = (state: FifoState): FifoState => ({
  lots: state.lots.map((lot) => ({ ...lot })),
  exits: new Map(state.exits),
});

const oldestFirst = (lots: FifoLot[], productId: string) => lots
  .filter((lot) => lot.productId === productId && lot.remainingQty > 0)
  .sort((a, b) => {
    if (a.receivedAt === null && b.receivedAt === null) return a.id < b.id ? -1 : 1;
    if (a.receivedAt === null) return 1;
    if (b.receivedAt === null) return -1;
    if (a.receivedAt === b.receivedAt) return a.id < b.id ? -1 : 1;
    return a.receivedAt < b.receivedAt ? -1 : 1;
  });

/**
 * Consumes remaining quantity oldest-first. Unknown-age lots are last.
 * A repeated key returns the original allocation and does not consume again.
 * A shortfall leaves the state unchanged and never drives a lot below zero.
 * Transfers are rejected because the data model has no branch ledger.
 */
export function allocateFifo(
  state: FifoState,
  key: string,
  productId: string,
  quantity: number,
  source: 'sale' | 'supplier_return' | 'adjustment_decrease' | 'transfer',
): FifoResult {
  if (source === 'transfer') {
    return { ok: false, reason: 'unsupported', allocations: [], state };
  }
  const prior = state.exits.get(key);
  if (prior) return { ok: true, reason: 'replay', allocations: prior, state };
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, reason: 'short', allocations: [], state };
  }
  const next = clone(state);
  const ordered = oldestFirst(next.lots, productId);
  const available = ordered.reduce((sum, lot) => sum + lot.remainingQty, 0);
  if (available < quantity) return { ok: false, reason: 'short', allocations: [], state };
  let left = quantity;
  const allocations: FifoAllocation[] = [];
  for (const lot of ordered) {
    if (left === 0) break;
    const take = Math.min(lot.remainingQty, left);
    lot.remainingQty -= take;
    left -= take;
    allocations.push({ lotId: lot.id, quantity: take, unitCost: lot.unitCost });
  }
  next.exits.set(key, allocations);
  return { ok: true, allocations, state: next };
}

/** Puts an exit back onto the same lots. A second reversal of the same key does nothing. */
export function reverseFifo(state: FifoState, key: string): FifoResult {
  const prior = state.exits.get(key);
  if (!prior) return { ok: true, reason: 'replay', allocations: [], state };
  const next = clone(state);
  for (const allocation of prior) {
    const lot = next.lots.find((item) => item.id === allocation.lotId);
    if (!lot) return { ok: false, reason: 'short', allocations: [], state };
    lot.remainingQty += allocation.quantity;
  }
  next.exits.delete(key);
  return { ok: true, allocations: prior, state: next };
}

/** A customer restock is a new lot dated at the return, not a rewritten historical receipt. */
export function restockReturn(state: FifoState, lot: FifoLot): FifoState {
  const next = clone(state);
  next.lots.push({ ...lot, source: 'customer_return_restock' });
  return next;
}
