/**
 * Read-only club catalog rules.
 * physical_quantity is on-hand stock, not quantity available after reservations.
 * expected_on is a calendar date, not a timestamp and not a delivery promise.
 * Tire specs are unverified because the active schema has no product_tire_specs table.
 * Import orders have no draft status: `ordered` is the status of a newly stored order,
 * so the schema cannot separate a plan from a supplier order. Those rows are included.
 * `received_pending_costs` is excluded because that status means the goods were received.
 */

export const CLUB_SCOPE = "club";
export const DEFAULT_PAGE_LIMIT = 100;
export const MAX_PAGE_LIMIT = 500;

export const PURCHASE_INCOMING_STATUSES = ["awaiting_receipt", "partially_received"] as const;
export const IMPORT_INCOMING_STATUSES = [
  "ordered",
  "preparing",
  "shipped",
  "in_transit",
  "arrived_israel",
  "customs_clearance",
  "receiving",
] as const;

export type SourceType = "purchase_order" | "import_order";

export interface StockSourceRow {
  id: string;
  name: string | null;
  brandId: string | null;
  brandName: string | null;
  image: string | null;
  quantity: number | null;
  updatedAt: string | null;
}

export interface InStockProduct {
  product_id: string;
  name: string;
  brand: { id: string; name: string } | null;
  image: string | null;
  tire_spec: null;
  tire_spec_verified: false;
  physical_quantity: number;
  updated_at: string | null;
  quantity_meaning: "physical_on_hand";
}

export interface IncomingSourceRow {
  sourceType: SourceType;
  sourceId: string;
  lineId: string;
  productId: string | null;
  documentStatus: string;
  lineStatus: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  notArrivingQuantity: number;
  name: string | null;
  brandId: string | null;
  brandName: string | null;
  storedBrand: string | null;
  storedModel: string | null;
  storedSizeLabel: string | null;
  storedLoadIndex: string | null;
  storedSpeedRating: string | null;
  expectedOn: string | null;
  /** Set only from an explicit stored link. Names and dates never fill this. */
  explicitLinkKey: string | null;
}

export interface ShipmentIdentity {
  source_type: SourceType;
  source_id: string;
  line_id: string;
}

export interface IncomingItem extends ShipmentIdentity {
  product_id: string | null;
  name: string | null;
  brand: { id: string; name: string } | null;
  stored_item: {
    brand: string | null;
    model: string | null;
    size_label: string | null;
    load_index: string | null;
    speed_rating: string | null;
  };
  tire_spec: null;
  tire_spec_verified: false;
  remaining_quantity: number;
  expected_on: string | null;
  expected_on_passed: boolean | null;
  expected_on_kind: "date";
  same_shipment_as: ShipmentIdentity[];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function jerusalemDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function pageLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(MAX_PAGE_LIMIT, parsed);
}

export function selectInStock(rows: StockSourceRow[]): InStockProduct[] {
  return rows
    .filter((row) => row.id && row.name && Number.isInteger(row.quantity) && (row.quantity as number) > 0)
    .map((row) => ({
      product_id: row.id,
      name: row.name as string,
      brand: row.brandId && row.brandName ? { id: row.brandId, name: row.brandName } : null,
      image: row.image?.trim() ? row.image : null,
      tire_spec: null,
      tire_spec_verified: false as const,
      physical_quantity: row.quantity as number,
      updated_at: row.updatedAt,
      quantity_meaning: "physical_on_hand" as const,
    }))
    .sort((left, right) => left.product_id.localeCompare(right.product_id));
}

export function remainingQuantity(row: IncomingSourceRow): number {
  const base = [row.orderedQuantity, row.receivedQuantity, row.notArrivingQuantity];
  if (!base.every((value) => Number.isInteger(value) && value >= 0)) return 0;
  const withheld = row.sourceType === "import_order" ? row.notArrivingQuantity : 0;
  return Math.max(0, row.orderedQuantity - row.receivedQuantity - withheld);
}

export function incomingEligible(row: IncomingSourceRow): boolean {
  if (row.sourceType === "purchase_order") {
    return (PURCHASE_INCOMING_STATUSES as readonly string[]).includes(row.documentStatus);
  }
  if (!(IMPORT_INCOMING_STATUSES as readonly string[]).includes(row.documentStatus)) return false;
  if (row.lineStatus === "cancelled" || row.lineStatus === "received") return false;
  return true;
}

function storedDate(value: string | null): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  if (!DATE_ONLY.test(day)) return null;
  if (value.length !== 10 && value[10] !== "T") return null;
  return day;
}

function toIncomingItem(row: IncomingSourceRow, today: string, sameShipmentAs: ShipmentIdentity[]): IncomingItem {
  const expectedOn = storedDate(row.expectedOn);
  return {
    source_type: row.sourceType,
    source_id: row.sourceId,
    line_id: row.lineId,
    product_id: row.productId,
    name: row.name,
    brand: row.brandId && row.brandName ? { id: row.brandId, name: row.brandName } : null,
    stored_item: {
      brand: row.storedBrand,
      model: row.storedModel,
      size_label: row.storedSizeLabel,
      load_index: row.storedLoadIndex,
      speed_rating: row.storedSpeedRating,
    },
    tire_spec: null,
    tire_spec_verified: false,
    remaining_quantity: remainingQuantity(row),
    expected_on: expectedOn,
    expected_on_passed: expectedOn ? expectedOn < today : null,
    expected_on_kind: "date",
    same_shipment_as: sameShipmentAs,
  };
}

export function incomingCursor(item: Pick<IncomingItem, "source_type" | "line_id">): string {
  return `${item.source_type}:${item.line_id}`;
}

export function selectIncoming(rows: IncomingSourceRow[], today: string): IncomingItem[] {
  const eligible = rows.filter((row) => incomingEligible(row) && remainingQuantity(row) > 0 && row.lineId && row.sourceId);
  const groups = new Map<string, IncomingSourceRow[]>();
  const singles: IncomingSourceRow[] = [];
  for (const row of eligible) {
    if (!row.explicitLinkKey) {
      singles.push(row);
      continue;
    }
    const group = groups.get(row.explicitLinkKey) ?? [];
    group.push(row);
    groups.set(row.explicitLinkKey, group);
  }
  const items = singles.map((row) => toIncomingItem(row, today, []));
  for (const group of groups.values()) {
    const ordered = [...group].sort((left, right) => incomingCursor({
      source_type: left.sourceType,
      line_id: left.lineId,
    }).localeCompare(incomingCursor({ source_type: right.sourceType, line_id: right.lineId })));
    const [kept, ...rest] = ordered;
    items.push(toIncomingItem(kept, today, rest.map((row) => ({
      source_type: row.sourceType,
      source_id: row.sourceId,
      line_id: row.lineId,
    }))));
  }
  return items.sort((left, right) => incomingCursor(left).localeCompare(incomingCursor(right)));
}

export function pageItems<T>(items: T[], after: string | null, limit: number, cursorOf: (item: T) => string): {
  cursorFound: boolean;
  data: T[];
  next_after: string | null;
} {
  if (after && !items.some((item) => cursorOf(item) === after)) {
    return { cursorFound: false, data: [], next_after: null };
  }
  const start = after ? items.findIndex((item) => cursorOf(item) === after) + 1 : 0;
  const slice = items.slice(start, start + limit);
  const last = slice.at(-1);
  const nextIndex = start + slice.length;
  return {
    cursorFound: true,
    data: slice,
    next_after: last && nextIndex < items.length ? cursorOf(last) : null,
  };
}
