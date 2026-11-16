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

export interface StoredDiscountRow {
  referenceType: string | null;
  listUnitIls: number | null;
  discountIls: number | null;
  discountPercent: number | null;
  salespersonEmployeeId: string | null;
  transactionId: string | null;
  productId: string;
  quantity: number;
  saleTotalIls: number | null;
}

export interface KnownDiscount {
  amount: number;
  percent: number;
}

/**
 * The catalog price on the locked product is the only list price the server accepts.
 * An omitted client value is not a fabricated price. A sent value must match the catalog,
 * including when both are unknown.
 */
export function catalogListAccepted(sent: number | null | undefined, catalog: number | null): boolean {
  if (sent === undefined) return true;
  if (sent === null || catalog === null) return sent === null && catalog === null;
  return sent === catalog;
}

/**
 * Historical rows are not repriced from the current catalog.
 * A quick-sale stock movement is unknown: the deployed function copied the charged
 * price into the list field and did not store a discount.
 * An older legacy row with both list and discount stored as 0 is the writer that
 * substituted 0 for a missing price, so it stays unknown.
 * A stored list and a stored discount, including a real zero, are known.
 */
export function knownStoredDiscount(row: StoredDiscountRow): KnownDiscount | null {
  if (row.saleTotalIls === null) return null;
  if (row.discountIls === null || row.listUnitIls === null) return null;
  if (row.referenceType === 'sale_transaction') return null;
  if (row.referenceType !== 'legacy_sale_request' && row.referenceType !== 'sale_line_snapshot' && row.listUnitIls === 0 && row.discountIls === 0) {
    return null;
  }
  return { amount: row.discountIls, percent: row.discountPercent ?? 0 };
}

export interface EmployeeDiscountLine {
  employeeId: string | null;
  transactionId: string;
  productId: string;
  quantity: number;
  discountIls: number;
  discountPercent: number;
}

export type GroupShape = 'single' | 'pair' | 'set' | 'mixed';

export interface EmployeeDiscountTotal {
  employeeId: string | null;
  discountIls: number;
  units: number;
  listTotalIls: number;
  /** Discount divided by the known list total. Null when that total is 0. Not a performance judgment. */
  ratePct: number | null;
}

export interface EmployeeDiscountReport {
  knownAmount: number;
  knownUnits: number;
  /** Transactions whose every line has a known zero discount. */
  fullPriceSales: number;
  /** Transactions whose known discounts add up to more than zero. */
  discountedSales: number;
  unknownRows: number;
  /** Known discount rows that have no transaction id, so they are not called a set. */
  ungroupedKnownRows: number;
  shapes: Record<GroupShape, number>;
  byEmployee: EmployeeDiscountTotal[];
  lines: EmployeeDiscountLine[];
}

const shapeOf = (units: number): GroupShape => {
  if (units === 1) return 'single';
  if (units === 2) return 'pair';
  if (units === 4) return 'set';
  return 'mixed';
};

export function employeeDiscountReport(rows: StoredDiscountRow[]): EmployeeDiscountReport {
  const lines: EmployeeDiscountLine[] = [];
  const groups = new Map<string, { units: number; discount: number; unknown: boolean; known: boolean; products: Set<string> }>();
  const people = new Map<string, EmployeeDiscountTotal>();
  let knownAmount = 0;
  let knownUnits = 0;
  let unknownRows = 0;
  let ungroupedKnownRows = 0;

  const addPerson = (row: StoredDiscountRow, amount: number, units: number) => {
    const key = row.salespersonEmployeeId ?? '';
    const person = people.get(key) ?? { employeeId: row.salespersonEmployeeId, discountIls: 0, units: 0, listTotalIls: 0, ratePct: null };
    person.discountIls += amount;
    person.units += units;
    if (row.listUnitIls !== null) person.listTotalIls += row.listUnitIls * units;
    people.set(key, person);
  };

  rows.forEach((row) => {
    const known = knownStoredDiscount(row);
    if (row.transactionId && !known) {
      unknownRows += 1;
      const group = groups.get(row.transactionId) ?? { units: 0, discount: 0, unknown: false, known: false, products: new Set<string>() };
      group.unknown = true;
      groups.set(row.transactionId, group);
      return;
    }
    if (!known) {
      unknownRows += 1;
      return;
    }
    const units = Math.abs(row.quantity);
    knownAmount += known.amount;
    knownUnits += units;
    addPerson(row, known.amount, units);
    if (!row.transactionId) {
      ungroupedKnownRows += 1;
      return;
    }
    lines.push({
      employeeId: row.salespersonEmployeeId,
      transactionId: row.transactionId,
      productId: row.productId,
      quantity: units,
      discountIls: known.amount,
      discountPercent: known.percent,
    });
    const group = groups.get(row.transactionId) ?? { units: 0, discount: 0, unknown: false, known: false, products: new Set<string>() };
    group.units += units;
    group.discount += known.amount;
    group.known = true;
    group.products.add(row.productId);
    groups.set(row.transactionId, group);
  });

  const shapes: Record<GroupShape, number> = { single: 0, pair: 0, set: 0, mixed: 0 };
  let fullPriceSales = 0;
  let discountedSales = 0;
  for (const group of groups.values()) {
    if (!group.known || group.unknown) continue;
    shapes[group.products.size === 1 ? shapeOf(group.units) : 'mixed'] += 1;
    if (group.discount > 0) discountedSales += 1;
    else fullPriceSales += 1;
  }
  const byEmployee = [...people.values()].map((person) => ({
    ...person,
    ratePct: person.listTotalIls > 0 ? (person.discountIls / person.listTotalIls) * 100 : null,
  }));
  return {
    knownAmount,
    knownUnits,
    fullPriceSales,
    discountedSales,
    unknownRows,
    ungroupedKnownRows,
    shapes,
    byEmployee,
    lines,
  };
}
