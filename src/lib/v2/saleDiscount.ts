/**
 * List price and discount for one new sale line.
 * A missing catalog price stays unknown. It is not stored as zero and it does
 * not create a discount. A known list price can still have a real zero discount.
 */
export interface SaleDiscountSnapshot {
  listUnitIls: number | null;
  discountIls: number | null;
  discountPercent: number | null;
}

export function snapshotSaleDiscount(
  listUnitIls: number | null,
  chargedTotalIls: number,
  quantity: number,
): SaleDiscountSnapshot {
  if (listUnitIls === null || !Number.isInteger(quantity) || quantity < 1) {
    return { listUnitIls, discountIls: null, discountPercent: null };
  }
  const listTotal = listUnitIls * quantity;
  const raw = listTotal - chargedTotalIls;
  if (!(raw > 0) || !(listTotal > 0)) {
    return { listUnitIls, discountIls: 0, discountPercent: 0 };
  }
  return {
    listUnitIls,
    discountIls: raw,
    discountPercent: (raw / listTotal) * 100,
  };
}
