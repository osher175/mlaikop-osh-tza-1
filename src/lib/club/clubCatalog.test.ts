import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  incomingCursor,
  jerusalemDate,
  pageItems,
  selectIncoming,
  selectInStock,
  type IncomingSourceRow,
  type StockSourceRow,
} from "../../../supabase/functions/club-api/catalog.ts";
import { handleClubRequest, ClubSourceError, type ClubDeps, type ClubKey } from "../../../supabase/functions/club-api/handler.ts";

const now = new Date("2026-11-25T12:00:00.000Z");
const today = jerusalemDate(now);
assert.equal(today, "2026-11-25");

const stock = (patch: Partial<StockSourceRow>): StockSourceRow => ({
  id: "p1",
  name: "Primacy",
  brandId: "b1",
  brandName: "Michelin",
  image: "https://cdn.example/tire.png",
  quantity: 4,
  updatedAt: "2026-11-20T08:00:00.000Z",
  ...patch,
});

const inStock = selectInStock([
  stock({}),
  stock({ id: "zero", quantity: 0 }),
  stock({ id: "missing", quantity: null }),
  stock({ id: "negative", quantity: -1 }),
]);
assert.deepEqual(inStock.map((row) => row.product_id), ["p1"]);
assert.equal(inStock[0].physical_quantity, 4);
assert.equal(inStock[0].tire_spec, null);
assert.equal(inStock[0].tire_spec_verified, false);
assert.deepEqual(inStock[0].brand, { id: "b1", name: "Michelin" });
assert.equal(inStock[0].quantity_meaning, "physical_on_hand");

const purchase = (patch: Partial<IncomingSourceRow>): IncomingSourceRow => ({
  sourceType: "purchase_order",
  sourceId: "po-1",
  lineId: "line-1",
  productId: "p1",
  documentStatus: "awaiting_receipt",
  lineStatus: null,
  orderedQuantity: 4,
  receivedQuantity: 0,
  notArrivingQuantity: 0,
  name: "Primacy",
  brandId: null,
  brandName: null,
  storedBrand: "Michelin",
  storedModel: "Primacy",
  storedSizeLabel: "205/55R16",
  storedLoadIndex: "91",
  storedSpeedRating: "V",
  expectedOn: "2026-12-01",
  explicitLinkKey: null,
  ...patch,
});

const imported = (patch: Partial<IncomingSourceRow>): IncomingSourceRow => ({
  ...purchase({
    sourceType: "import_order",
    sourceId: "im-1",
    lineId: "imp-line-1",
    documentStatus: "in_transit",
    lineStatus: "pending",
    name: "Pilot Sport",
    storedModel: "Pilot Sport",
    expectedOn: "2026-10-01",
  }),
  ...patch,
});

const both = selectIncoming([
  purchase({}),
  purchase({ sourceId: "po-2", lineId: "line-2", expectedOn: "2026-12-15", orderedQuantity: 2 }),
  imported({}),
], today);
assert.equal(both.length, 3);
assert.deepEqual(both.map((row) => row.line_id), ["imp-line-1", "line-1", "line-2"]);
assert.equal(both.find((row) => row.line_id === "line-1")?.remaining_quantity, 4);
assert.equal(both.find((row) => row.line_id === "imp-line-1")?.expected_on, "2026-10-01");
assert.equal(both.find((row) => row.line_id === "imp-line-1")?.expected_on_passed, true);
assert.equal(both.find((row) => row.line_id === "line-1")?.expected_on_passed, false);

const unlinked = selectIncoming([purchase({ productId: null, lineId: "new-spec", name: "Dimax", storedModel: "Dimax" })], today);
assert.equal(unlinked[0].product_id, null);
assert.equal(unlinked[0].line_id, "new-spec");
assert.equal(unlinked[0].tire_spec_verified, false);
assert.equal(unlinked[0].stored_item.size_label, "205/55R16");

const linked = selectIncoming([purchase({ productId: "created-1", lineId: "new-spec", receivedQuantity: 2, documentStatus: "partially_received" })], today);
assert.equal(linked[0].product_id, "created-1");
assert.equal(linked[0].line_id, "new-spec");
assert.equal(linked[0].remaining_quantity, 2);

assert.equal(selectIncoming([purchase({ receivedQuantity: 4, documentStatus: "completed" })], today).length, 0);
assert.equal(selectIncoming([purchase({ receivedQuantity: 4, documentStatus: "partially_received" })], today).length, 0);
assert.equal(selectIncoming([purchase({ documentStatus: "draft" })], today).length, 0);
assert.equal(selectIncoming([purchase({ documentStatus: "cancelled" })], today).length, 0);
assert.equal(selectIncoming([imported({ documentStatus: "received_pending_costs" })], today).length, 0);
assert.equal(selectIncoming([imported({ documentStatus: "cancelled" })], today).length, 0);
assert.equal(selectIncoming([imported({ lineStatus: "cancelled" })], today).length, 0);
assert.equal(selectIncoming([imported({ lineStatus: "received", receivedQuantity: 1, orderedQuantity: 4 })], today).length, 0);
assert.equal(selectIncoming([purchase({ expectedOn: "2026-12-01T00:00:00.000Z" })], today)[0].expected_on, "2026-12-01");
assert.equal(selectIncoming([purchase({ expectedOn: "soon" })], today)[0].expected_on, null);
assert.equal(selectIncoming([purchase({ expectedOn: null })], today)[0].expected_on, null);
assert.equal(selectIncoming([purchase({ expectedOn: null })], today)[0].expected_on_passed, null);

const sameName = selectIncoming([
  purchase({ lineId: "a", name: "Same", expectedOn: "2026-12-01" }),
  imported({ lineId: "b", name: "Same", expectedOn: "2026-12-01", productId: "p1" }),
], today);
assert.equal(sameName.length, 2);

const linkedShipments = selectIncoming([
  purchase({ lineId: "po-line", explicitLinkKey: "shipment-7", orderedQuantity: 3 }),
  imported({ lineId: "im-line", explicitLinkKey: "shipment-7", orderedQuantity: 3, productId: "p1" }),
], today);
assert.equal(linkedShipments.length, 1);
assert.equal(linkedShipments[0].remaining_quantity, 3);
assert.equal(linkedShipments[0].same_shipment_as.length, 1);

const pages = pageItems(both, null, 2, incomingCursor);
assert.equal(pages.data.length, 2);
assert.equal(pages.next_after, incomingCursor(pages.data[1]));
const rest = pageItems(both, pages.next_after, 2, incomingCursor);
assert.deepEqual(rest.data.map((row) => row.line_id), ["line-2"]);
assert.equal(rest.next_after, null);
const seen = [...pages.data, ...rest.data].map((row) => row.line_id);
assert.deepEqual(seen, both.map((row) => row.line_id));
assert.equal(pageItems(both, "missing", 2, incomingCursor).cursorFound, false);

const key: ClubKey = {
  id: "key-1",
  businessId: "business-a",
  revokedAt: null,
  expiresAt: null,
  scope: "club",
  rateLimitPerMin: 60,
};
const calls: string[] = [];
const deps = (patch: Partial<ClubDeps> = {}): ClubDeps => ({
  findKey: async () => key,
  recentUseCount: async () => 0,
  logUse: async () => undefined,
  loadStock: async (businessId) => {
    calls.push(businessId);
    return [stock({})];
  },
  loadIncoming: async (businessId) => {
    calls.push(`incoming:${businessId}`);
    return [purchase({})];
  },
  ...patch,
});

const ask = (patch: Partial<Parameters<typeof handleClubRequest>[0]> = {}, localDeps = deps()) => handleClubRequest({
  method: "GET",
  path: "/in-stock",
  apiKey: "mlk_test",
  searchParams: new URLSearchParams(),
  now,
  deps: localDeps,
  ...patch,
});

const stockResponse = await ask({ searchParams: new URLSearchParams("business_id=business-b") });
assert.equal(stockResponse.status, 200);
assert.equal(calls[0], "business-a");
const stockBody = stockResponse.body as { data: Array<{ product_id: string }>; collection: string };
assert.equal(stockBody.collection, "in_stock");
assert.equal(stockBody.data[0].product_id, "p1");

const incomingResponse = await ask({ path: "/incoming" });
assert.equal(incomingResponse.status, 200);
assert.equal((incomingResponse.body as { collection: string }).collection, "incoming");

assert.equal((await ask({ method: "POST" })).status, 405);
assert.equal((await ask({ method: "PUT" })).status, 405);
assert.equal((await ask({ apiKey: null })).status, 401);
assert.equal((await ask({}, deps({ findKey: async () => null }))).status, 401);
assert.equal((await ask({}, deps({ findKey: async () => ({ ...key, scope: "retail_iq" }) }))).status, 401);
assert.equal((await ask({}, deps({ findKey: async () => ({ ...key, revokedAt: now.toISOString() }) }))).status, 401);
assert.equal((await ask({}, deps({ findKey: async () => ({ ...key, expiresAt: "2020-01-01T00:00:00.000Z" }) }))).status, 401);
assert.equal((await ask({}, deps({ recentUseCount: async () => 60 }))).status, 429);
assert.equal((await ask({}, deps({ loadStock: async () => { throw new ClubSourceError("stock_unavailable"); } }))).status, 503);
const incomingFailure = await ask({ path: "/incoming" }, deps({
  loadIncoming: async () => { throw new ClubSourceError("incoming_unavailable"); },
}));
assert.equal(incomingFailure.status, 503);
assert.equal((incomingFailure.body as { code: string }).code, "incoming_unavailable");
assert.equal("data" in (incomingFailure.body as object), false);

const forbidden = ["cost", "price", "supplier", "profit", "employee", "customer", "notes", "email", "phone", "agreed_unit_cost"];
const keysOf = (value: unknown, found = new Set<string>()): Set<string> => {
  if (!value || typeof value !== "object") return found;
  for (const [name, child] of Object.entries(value)) {
    found.add(name);
    keysOf(child, found);
  }
  return found;
};
for (const body of [stockResponse.body, incomingResponse.body]) {
  for (const name of forbidden) assert.equal(keysOf(body).has(name), false, name);
}

const retail = readFileSync("supabase/functions/retail-iq-api/index.ts", "utf8");
const clubIndex = readFileSync("supabase/functions/club-api/index.ts", "utf8");
const manage = readFileSync("supabase/functions/api-keys-manage/index.ts", "utf8");
assert.match(retail, /scope !== "retail_iq"/);
assert.equal(retail.includes("CLUB_SCOPE"), false);
const selects = clubIndex.match(/\.select\("[^"]+"\)/g) ?? [];
assert.equal(selects.length >= 3, true);
for (const select of selects) {
  for (const word of ["*", "cost", "price", "supplier", "notes", "email"]) assert.equal(select.includes(word), false, select);
}
assert.match(manage, /"club"/);
assert.match(readFileSync("docs/v2/club-api-scope.UNAPPLIED.sql", "utf8"), /scope IN \('public', 'retail_iq', 'club'\)/);

console.log("club catalog assertions passed");
