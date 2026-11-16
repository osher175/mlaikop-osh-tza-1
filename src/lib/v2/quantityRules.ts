/** Positive whole units. Shared by the receipt path and its tests. */
export function purchaseReceiptQuantityValid(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0;
}

/** A partial customer return cannot exceed the units the original sale deducted. */
export function partialReturnQuantityValid(quantity: number, soldUnits: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= soldUnits;
}

/** A supplier return removes at least one whole unit. */
export function supplierReturnQuantityValid(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1;
}
