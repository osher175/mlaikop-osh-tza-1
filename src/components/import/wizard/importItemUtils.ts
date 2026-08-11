/**
 * Presentation helpers shared by the guided import wizard.
 * No mutations, no business rules that the server does not already own.
 */

export const itemBrand = (item: any): string =>
  item?.brands?.name ?? item?.manufacturer_name ?? '';

export const itemModel = (item: any): string =>
  item?.model_name ?? item?.product_description ?? '';

export const itemSize = (item: any): string => item?.size_label ?? '';

/** מותג · דגם · מידה — the single label the whole wizard uses. */
export const itemTitle = (item: any): string => {
  const parts = [itemBrand(item), itemModel(item), itemSize(item)].filter(Boolean);
  return parts.length ? parts.join(' · ') : item?.supplier_sku || 'פריט';
};

/**
 * Composed description written into the NOT NULL `product_description` column
 * so existing screens/queries keep rendering a meaningful value.
 */
export const composeDescription = (brand: string, model: string, size: string) =>
  [brand, model, size].map((s) => s.trim()).filter(Boolean).join(' ') || 'פריט';

export interface LocalComparison {
  localUnit: number;
  importUnit: number;
  savingPerUnit: number;
  totalSaving: number;
  profitIfImported: number | null;
  profitIfLocal: number | null;
  extraProfit: number | null;
}

/**
 * Deterministic import-vs-local comparison.
 *
 *   savingPerUnit    = localUnit − importUnitCostToShelf
 *   totalSaving      = savingPerUnit × quantity
 *   profitIfImported = (plannedSale − importUnitCostToShelf) × quantity
 *   profitIfLocal    = (plannedSale − localUnit) × quantity
 *   extraProfit      = profitIfImported − profitIfLocal   (== totalSaving)
 *
 * A negative result means importing was the more expensive option; it is shown
 * as-is and never hidden.
 */
export const computeLocalComparison = (
  localUnit: number | null | undefined,
  importUnit: number | null | undefined,
  plannedSale: number | null | undefined,
  quantity: number
): LocalComparison | null => {
  if (localUnit == null || importUnit == null) return null;
  const lu = Number(localUnit);
  const iu = Number(importUnit);
  const qty = Number(quantity) || 0;
  const savingPerUnit = lu - iu;
  const sale = plannedSale == null ? null : Number(plannedSale);
  return {
    localUnit: lu,
    importUnit: iu,
    savingPerUnit,
    totalSaving: savingPerUnit * qty,
    profitIfImported: sale == null ? null : (sale - iu) * qty,
    profitIfLocal: sale == null ? null : (sale - lu) * qty,
    extraProfit: sale == null ? null : savingPerUnit * qty,
  };
};
