/**
 * Browser-only quick-sale draft. It is not a sale.
 * Scoped to one business and never sent to the database while persistence is closed.
 */
export type Axle = 'single' | 'front' | 'rear';

export interface DraftLine {
  key: string;
  productId: string;
  name: string;
  barcode: string | null;
  quantity: number;
  /** Stock observed when the line was added or last refreshed. Confirmation rechecks the server. */
  available: number;
  /** Catalog price treated as VAT-inclusive, matching sale_total_ils. Null when the product has no price. */
  unitPriceGross: number | null;
  /** Catalog price at the moment the line was added. Editing the charged price does not change it. Null stays unknown. */
  listUnitGross: number | null;
  /** Product cost as stored. Null is unknown. Zero is kept as zero and is not rewritten to null. */
  unitCost: number | null;
  axle: Axle;
  image?: string | null;
  sizeLabel?: string | null;
}

export interface SaleDraft {
  businessId: string;
  idempotencyKey: string;
  notes: string;
  /** Null means no employee is selected. A new sale cannot be confirmed until one active employee is chosen. Never the signed-in user. */
  salespersonEmployeeId: string | null;
  lines: DraftLine[];
}

const memory = new Map<string, SaleDraft>();
const listeners = new Set<() => void>();

const storageKey = (businessId: string) => `mlaiko.v2.saleDraft.${businessId}`;

export const emptyDraft = (businessId: string): SaleDraft => ({
  businessId,
  idempotencyKey: crypto.randomUUID(),
  notes: '',
  salespersonEmployeeId: null,
  lines: [],
});

const emit = () => listeners.forEach((listener) => listener());

const read = (businessId: string): SaleDraft => {
  const cached = memory.get(businessId);
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(storageKey(businessId));
    if (raw) {
      const parsed = JSON.parse(raw) as SaleDraft;
      if (parsed?.businessId === businessId && Array.isArray(parsed.lines) && parsed.idempotencyKey) {
        memory.set(businessId, parsed);
        return parsed;
      }
    }
  } catch {
    // A damaged draft is discarded. It was never a completed sale.
  }
  const created = emptyDraft(businessId);
  memory.set(businessId, created);
  return created;
};

const write = (draft: SaleDraft) => {
  memory.set(draft.businessId, draft);
  try {
    localStorage.setItem(storageKey(draft.businessId), JSON.stringify(draft));
  } catch {
    // The in-memory draft still works for this tab.
  }
  emit();
};

export const getSaleDraft = (businessId: string | null): SaleDraft | null => (businessId ? read(businessId) : null);

export const subscribeSaleDraft = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The values sent to complete_quick_sale. Display fields do not change the key. */
const salePayload = (draft: SaleDraft) => JSON.stringify({
  notes: draft.notes,
  salespersonEmployeeId: draft.salespersonEmployeeId,
  lines: draft.lines.map((line) => [line.productId, line.quantity, line.unitPriceGross, line.axle]),
});

const update = (businessId: string, change: (draft: SaleDraft) => SaleDraft) => {
  const current = read(businessId);
  const next = change(current);
  if (salePayload(current) === salePayload(next)) {
    write(next);
    return;
  }
  write({ ...next, idempotencyKey: crypto.randomUUID() });
};

export const quantityOnDraft = (draft: SaleDraft, productId: string, exceptKey?: string) =>
  draft.lines.reduce((sum, line) => sum + (line.productId === productId && line.key !== exceptKey ? line.quantity : 0), 0);

export const addDraftLine = (businessId: string, line: Omit<DraftLine, 'key' | 'quantity'> & { quantity: number }) => {
  update(businessId, (draft) => {
    const existing = draft.lines.find((item) => item.productId === line.productId && item.axle === line.axle);
    const others = quantityOnDraft(draft, line.productId, existing?.key);
    const room = Math.max(0, line.available - others);
    const quantity = Math.min(Math.max(1, Math.floor(line.quantity)), room);
    if (quantity < 1) return draft;
    if (existing) {
      return {
        ...draft,
        lines: draft.lines.map((item) => item.key === existing.key
          ? { ...item, ...line, key: item.key, quantity: item.quantity + quantity, listUnitGross: item.listUnitGross ?? null }
          : item),
      };
    }
    return { ...draft, lines: [...draft.lines, { ...line, key: crypto.randomUUID(), quantity }] };
  });
};

export const setDraftQuantity = (businessId: string, key: string, quantity: number) => {
  update(businessId, (draft) => ({
    ...draft,
    lines: draft.lines.flatMap((line) => {
      if (line.key !== key) return [line];
      const others = quantityOnDraft(draft, line.productId, line.key);
      const next = Math.min(Math.max(0, Math.floor(quantity)), Math.max(0, line.available - others));
      return next < 1 ? [] : [{ ...line, quantity: next }];
    }),
  }));
};

export const setDraftPrice = (businessId: string, key: string, unitPriceGross: number | null) => {
  update(businessId, (draft) => ({
    ...draft,
    lines: draft.lines.map((line) => line.key === key ? { ...line, unitPriceGross } : line),
  }));
};

export const removeDraftLine = (businessId: string, key: string) => {
  update(businessId, (draft) => ({ ...draft, lines: draft.lines.filter((line) => line.key !== key) }));
};

export const setDraftNotes = (businessId: string, notes: string) => {
  update(businessId, (draft) => ({ ...draft, notes: notes.slice(0, 500) }));
};

export const setDraftSalesperson = (businessId: string, salespersonEmployeeId: string | null) => {
  update(businessId, (draft) => ({ ...draft, salespersonEmployeeId }));
};

/** Drops the draft and rotates the idempotency key. Does not reverse a sale. */
export const clearSaleDraft = (businessId: string) => {
  write(emptyDraft(businessId));
};
