import { snapshotSaleDiscount } from '@/lib/v2/saleDiscount';

/**
 * Plans the legacy product editor and the new-product opening balance.
 * Quantity changes become one execute_inventory_transaction call.
 * The following product update carries metadata only.
 */
export type StockActionType = 'add' | 'remove' | 'adjust';

export interface StockCommand {
  actionType: StockActionType;
  quantityChanged: number;
  notes: string;
  saleTotalIls?: number;
  saleUnitIls?: number;
  listUnitIls?: number | null;
  discountIls?: number | null;
  discountPercent?: number | null;
  costSnapshotIls?: number;
  purchaseUnitIls?: number;
  purchaseTotalIls?: number;
  supplierId?: string | null;
}

export interface PlannedLegacySave {
  businessId: string;
  productId: string;
  stock: StockCommand | null;
  /** The product update never includes quantity. */
  metadataOmitsQuantity: true;
  /** A purchase lets the transaction function set the rolling average. */
  metadataOmitsCost: boolean;
  error: string | null;
}

export interface OpeningStockPlan {
  stock: StockCommand | null;
  error: string | null;
}

const integerQuantity = (value: number) => Number.isInteger(value);

export function planLegacyProductSave(input: {
  businessId: string;
  productId: string;
  oldQuantity: number;
  newQuantity: number;
  listUnitIls: number | null;
  costSnapshotIls: number;
  sale: { saleTotalIls: number; notes?: string } | null;
  purchase: { purchaseUnitIls: number; purchaseTotalIls: number; supplierId?: string | null; notes?: string } | null;
  /** A count correction is an adjust transaction. The reason is stored on the ledger row. */
  correctionReason?: string | null;
}): PlannedLegacySave {
  const empty = (error: string): PlannedLegacySave => ({
    businessId: input.businessId,
    productId: input.productId,
    stock: null,
    metadataOmitsQuantity: true,
    metadataOmitsCost: false,
    error,
  });

  if (!input.businessId || !input.productId) return empty('missing business or product');
  if (!integerQuantity(input.oldQuantity) || !integerQuantity(input.newQuantity)) return empty('invalid quantity');
  if (input.newQuantity < 0) return empty('negative stock');

  const quantityChanged = input.newQuantity - input.oldQuantity;
  if (quantityChanged === 0) {
    return {
      businessId: input.businessId,
      productId: input.productId,
      stock: null,
      metadataOmitsQuantity: true,
      metadataOmitsCost: false,
      error: null,
    };
  }

  const correctionReason = input.correctionReason?.trim() ?? '';
  if (!input.sale && !input.purchase && correctionReason) {
    return {
      businessId: input.businessId,
      productId: input.productId,
      stock: {
        actionType: 'adjust',
        quantityChanged,
        notes: correctionReason,
      },
      metadataOmitsQuantity: true,
      metadataOmitsCost: false,
      error: null,
    };
  }

  if (quantityChanged < 0) {
    if (!input.sale || input.purchase) return empty('sale details required');
    const sold = Math.abs(quantityChanged);
    const priced = snapshotSaleDiscount(input.listUnitIls, input.sale.saleTotalIls, sold);
    return {
      businessId: input.businessId,
      productId: input.productId,
      stock: {
        actionType: 'remove',
        quantityChanged,
        saleTotalIls: input.sale.saleTotalIls,
        saleUnitIls: input.sale.saleTotalIls / sold,
        listUnitIls: priced.listUnitIls,
        discountIls: priced.discountIls,
        discountPercent: priced.discountPercent,
        costSnapshotIls: input.costSnapshotIls,
        notes: input.sale.notes || `מכירה של ${sold} יחידות`,
      },
      metadataOmitsQuantity: true,
      metadataOmitsCost: false,
      error: null,
    };
  }

  if (!input.purchase || input.sale) return empty('purchase details required');
  return {
    businessId: input.businessId,
    productId: input.productId,
    stock: {
      actionType: 'add',
      quantityChanged,
      purchaseUnitIls: input.purchase.purchaseUnitIls,
      purchaseTotalIls: input.purchase.purchaseTotalIls,
      supplierId: input.purchase.supplierId ?? null,
      notes: input.purchase.notes || `קנייה של ${quantityChanged} יחידות`,
    },
    metadataOmitsQuantity: true,
    metadataOmitsCost: true,
    error: null,
  };
}

/**
 * Opening quantity is applied after the product row exists at quantity 0.
 * A missing unit cost uses adjust so a zero is not stored as a known cost.
 * adjust is in the latest transaction signature. Isolated verification must
 * confirm the live function accepts it before a cost-free opening balance.
 */
export function planOpeningStock(input: {
  quantity: number;
  unitCost: number | null;
  supplierId?: string | null;
}): OpeningStockPlan {
  if (!integerQuantity(input.quantity) || input.quantity < 0) return { stock: null, error: 'invalid quantity' };
  if (input.quantity === 0) return { stock: null, error: null };
  if (input.unitCost !== null && Number.isFinite(input.unitCost)) {
    return {
      stock: {
        actionType: 'add',
        quantityChanged: input.quantity,
        purchaseUnitIls: input.unitCost,
        purchaseTotalIls: input.unitCost * input.quantity,
        supplierId: input.supplierId ?? null,
        notes: `הוספת מוצר חדש עם ${input.quantity} יחידות ראשוניות`,
      },
      error: null,
    };
  }
  return {
    stock: {
      actionType: 'adjust',
      quantityChanged: input.quantity,
      notes: `הוספת מוצר חדש עם ${input.quantity} יחידות ראשוניות`,
    },
    error: null,
  };
}

export const EDITOR_OPERATION = 'editor_operation';

export interface OpeningAttempt {
  signature: string;
  operationId: string;
  productId: string | null;
}

/** Same name, barcode, quantity and cost keep one operation. A changed draft gets a new one. */
export function openingAttemptSignature(input: {
  businessId: string;
  name: string;
  barcode: string | null;
  quantity: number;
  unitCost: number | null;
}): string {
  return JSON.stringify({
    businessId: input.businessId,
    name: input.name.trim(),
    barcode: input.barcode?.trim() || null,
    quantity: input.quantity,
    unitCost: input.unitCost,
  });
}

export function resumeOpeningAttempt(
  pending: OpeningAttempt | null,
  signature: string,
  nextOperationId: string,
): OpeningAttempt {
  if (pending?.signature === signature) return pending;
  return { signature, operationId: nextOperationId, productId: null };
}

export function rpcIsMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === 'PGRST202' || /could not find the function|schema cache/i.test(message);
}

export function readLedgerActionId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const actionId = (value as { action_id?: unknown }).action_id;
  return typeof actionId === 'string' && actionId.length > 0 ? actionId : null;
}
