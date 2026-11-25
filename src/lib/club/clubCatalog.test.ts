import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { IncomingSourceRow, StockSourceRow } from "../../../supabase/functions/club-api/catalog.ts";
import { handleClubRequest, ClubSourceError, type ClubDeps, type ClubKey } from "../../../supabase/functions/club-api/handler.ts";

const now = new Date("2026-11-25T12:00:00.000Z");
const refresh = {
  replace_local_copy: "only_after_both_collections_and_every_page",
  on_failure: "keep_previous_copy",
  status_when_incomplete: "not_updated",
};

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

const key: ClubKey = {
  id: "key-1",
  businessId: "business-a",
  revokedAt: null,
  expiresAt: null,
  scope: "club",
  rateLimitPerMin: 60,
};

const logged: string[] = [];
const businesses: string[] = [];

const ask = (
  path: string,
  source: { stock?: StockSourceRow[]; incoming?: IncomingSourceRow[] } = {},
  params = "",
  patch: Partial<Parameters<typeof handleClubRequest>[0]> = {},
  depPatch: Partial<ClubDeps> = {},
) => {
  const deps: ClubDeps = {
    findKey: async () => key,
    recentUseCount: async () => 0,
    logUse: async (_id, _businessId, endpoint, status) => {
      logged.push(`${endpoint}:${status}`);
    },
    loadStock: async (businessId) => {
      businesses.push(businessId);
      return source.stock ?? [];
    },
    loadIncoming: async (businessId) => {
      businesses.push(`incoming:${businessId}`);
      return source.incoming ?? [];
    },
    ...depPatch,
  };
  return handleClubRequest({
    method: "GET",
    path,
    apiKey: "mlk_test",
    searchParams: new URLSearchParams(params),
    now,
    deps,
    ...patch,
  });
};

type IncomingBody = {
  collection: string;
  refresh: typeof refresh;
  data: Array<{
    line_id: string;
    product_id: string | null;
    remaining_quantity: number;
    expected_on: string | null;
    expected_on_passed: boolean | null;
    expected_on_kind: string;
    tire_spec: null;
    tire_spec_verified: boolean;
    stored_item: { size_label: string | null };
    same_shipment_as: Array<{ line_id: string }>;
  }>;
  next_after: string | null;
};

const stockPage = await ask("/in-stock", {
  stock: [
    stock({}),
    stock({ id: "zero", quantity: 0 }),
    stock({ id: "missing", quantity: null }),
    stock({ id: "negative", quantity: -1 }),
  ],
}, "business_id=business-b");
assert.equal(stockPage.status, 200);
assert.equal(logged.at(-1), "/in-stock:200");
assert.equal(businesses[0], "business-a");
const stockBody = stockPage.body as {
  collection: string;
  refresh: typeof refresh;
  reservation_meaning: string;
  data: Array<{ product_id: string; physical_quantity: number; tire_spec: null; tire_spec_verified: boolean; brand: { id: string; name: string }; quantity_meaning: string }>;
};
assert.equal(stockBody.collection, "in_stock");
assert.deepEqual(stockBody.refresh, refresh);
assert.equal(stockBody.reservation_meaning, "not_available_to_reserve");
assert.deepEqual(stockBody.data.map((row) => row.product_id), ["p1"]);
assert.equal(stockBody.data[0].physical_quantity, 4);
assert.equal(stockBody.data[0].tire_spec, null);
assert.equal(stockBody.data[0].tire_spec_verified, false);
assert.equal(stockBody.data[0].quantity_meaning, "physical_on_hand");

const shipments = [
  purchase({}),
  purchase({ sourceId: "po-2", lineId: "line-2", expectedOn: "2026-12-15", orderedQuantity: 2 }),
  imported({}),
];
const incomingPage = await ask("/incoming", { incoming: shipments });
assert.equal(incomingPage.status, 200);
assert.equal(logged.at(-1), "/incoming:200");
const incomingBody = incomingPage.body as IncomingBody;
assert.equal(incomingBody.collection, "incoming");
assert.deepEqual(incomingBody.refresh, refresh);
assert.deepEqual(incomingBody.data.map((row) => row.line_id), ["imp-line-1", "line-1", "line-2"]);
assert.equal(incomingBody.data.find((row) => row.line_id === "line-1")?.product_id, "p1");
assert.equal(incomingBody.data.find((row) => row.line_id === "imp-line-1")?.expected_on, "2026-10-01");
assert.equal(incomingBody.data.find((row) => row.line_id === "imp-line-1")?.expected_on_passed, true);
assert.equal(incomingBody.data.find((row) => row.line_id === "line-1")?.expected_on_passed, false);
assert.equal(incomingBody.data[0].expected_on_kind, "date");

const unlinked = await ask("/incoming", {
  incoming: [purchase({ productId: null, lineId: "new-spec", name: "Dimax", storedModel: "Dimax" })],
});
const unlinkedRow = (unlinked.body as IncomingBody).data[0];
assert.equal(unlinkedRow.product_id, null);
assert.equal(unlinkedRow.line_id, "new-spec");
assert.equal(unlinkedRow.tire_spec_verified, false);
assert.equal(unlinkedRow.stored_item.size_label, "205/55R16");

const linked = await ask("/incoming", {
  incoming: [purchase({ productId: "created-1", lineId: "new-spec", receivedQuantity: 2, documentStatus: "partially_received" })],
});
const linkedRow = (linked.body as IncomingBody).data[0];
assert.equal(linkedRow.product_id, "created-1");
assert.equal(linkedRow.line_id, "new-spec");
assert.equal(linkedRow.remaining_quantity, 2);

const excluded = await ask("/incoming", {
  incoming: [
    purchase({ lineId: "full", receivedQuantity: 4, documentStatus: "completed" }),
    purchase({ lineId: "full-open", receivedQuantity: 4, documentStatus: "partially_received" }),
    purchase({ lineId: "draft", documentStatus: "draft" }),
    purchase({ lineId: "cancelled", documentStatus: "cancelled" }),
    imported({ lineId: "costs", documentStatus: "received_pending_costs" }),
    imported({ lineId: "import-cancelled", documentStatus: "cancelled" }),
    imported({ lineId: "line-cancelled", lineStatus: "cancelled" }),
    imported({ lineId: "line-received", lineStatus: "received", receivedQuantity: 1, orderedQuantity: 4 }),
    purchase({ lineId: "undated", expectedOn: null }),
    purchase({ lineId: "soon", expectedOn: "soon" }),
    purchase({ lineId: "stamp", expectedOn: "2026-12-01T00:00:00.000Z" }),
  ],
});
const excludedBody = excluded.body as IncomingBody;
assert.deepEqual(excludedBody.data.map((row) => row.line_id), ["soon", "stamp", "undated"]);
assert.equal(excludedBody.data.find((row) => row.line_id === "undated")?.expected_on, null);
assert.equal(excludedBody.data.find((row) => row.line_id === "soon")?.expected_on, null);
assert.equal(excludedBody.data.find((row) => row.line_id === "stamp")?.expected_on, "2026-12-01");

const sameName = await ask("/incoming", {
  incoming: [
    purchase({ lineId: "a", name: "Same", expectedOn: "2026-12-01" }),
    imported({ lineId: "b", name: "Same", expectedOn: "2026-12-01", productId: "p1" }),
  ],
});
assert.equal((sameName.body as IncomingBody).data.length, 2);

const linkedShipments = await ask("/incoming", {
  incoming: [
    purchase({ lineId: "po-line", explicitLinkKey: "shipment-7", orderedQuantity: 3 }),
    imported({ lineId: "im-line", explicitLinkKey: "shipment-7", orderedQuantity: 3, productId: "p1" }),
  ],
});
const collapsed = (linkedShipments.body as IncomingBody).data;
assert.equal(collapsed.length, 1);
assert.equal(collapsed[0].remaining_quantity, 3);
assert.equal(collapsed[0].same_shipment_as.length, 1);

const first = await ask("/incoming", { incoming: shipments }, "limit=2");
const firstBody = first.body as IncomingBody;
assert.equal(firstBody.data.length, 2);
assert.equal(firstBody.next_after, "purchase_order:line-1");
const second = await ask("/incoming", { incoming: shipments }, `limit=2&after=${firstBody.next_after}`);
const secondBody = second.body as IncomingBody;
assert.deepEqual(secondBody.data.map((row) => row.line_id), ["line-2"]);
assert.equal(secondBody.next_after, null);
assert.deepEqual(
  [...firstBody.data, ...secondBody.data].map((row) => row.line_id),
  (incomingBody.data).map((row) => row.line_id),
);
const missingCursor = await ask("/incoming", { incoming: shipments }, "after=missing");
assert.equal(missingCursor.status, 409);
assert.equal((missingCursor.body as { code: string; refresh: typeof refresh }).code, "cursor_not_found");
assert.deepEqual((missingCursor.body as { refresh: typeof refresh }).refresh, refresh);
assert.equal("data" in (missingCursor.body as object), false);

const root = await ask("/");
assert.equal(root.status, 200);
assert.deepEqual((root.body as { refresh: typeof refresh; collections: string[] }).refresh, refresh);
assert.deepEqual((root.body as { collections: string[] }).collections, ["in_stock", "incoming"]);

assert.equal((await ask("/in-stock", {}, "", { method: "POST" })).status, 405);
assert.equal((await ask("/in-stock", {}, "", { method: "PUT" })).status, 405);
assert.equal((await ask("/in-stock", {}, "", { apiKey: null })).status, 401);
assert.equal((await ask("/in-stock", {}, "", {}, { findKey: async () => null })).status, 401);
assert.equal((await ask("/in-stock", {}, "", {}, { findKey: async () => ({ ...key, scope: "retail_iq" }) })).status, 401);
assert.equal((await ask("/in-stock", {}, "", {}, { findKey: async () => ({ ...key, revokedAt: now.toISOString() }) })).status, 401);
assert.equal((await ask("/in-stock", {}, "", {}, { findKey: async () => ({ ...key, expiresAt: "2020-01-01T00:00:00.000Z" }) })).status, 401);
assert.equal((await ask("/in-stock", {}, "", {}, { recentUseCount: async () => 60 })).status, 429);
const stockFailure = await ask("/in-stock", {}, "", {}, {
  loadStock: async () => { throw new ClubSourceError("stock_unavailable"); },
});
assert.equal(stockFailure.status, 503);
assert.deepEqual((stockFailure.body as { refresh: typeof refresh }).refresh, refresh);
const incomingFailure = await ask("/incoming", {}, "", {}, {
  loadIncoming: async () => { throw new ClubSourceError("incoming_unavailable"); },
});
assert.equal(incomingFailure.status, 503);
assert.equal((incomingFailure.body as { code: string }).code, "incoming_unavailable");
assert.equal("data" in (incomingFailure.body as object), false);
assert.deepEqual((incomingFailure.body as { refresh: typeof refresh }).refresh, refresh);

const forbidden = ["cost", "price", "supplier", "profit", "employee", "customer", "notes", "email", "phone", "agreed_unit_cost"];
const keysOf = (value: unknown, found = new Set<string>()): Set<string> => {
  if (!value || typeof value !== "object") return found;
  for (const [name, child] of Object.entries(value)) {
    found.add(name);
    keysOf(child, found);
  }
  return found;
};
for (const body of [stockPage.body, incomingPage.body, incomingFailure.body]) {
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
assert.match(readFileSync("docs/v2/club-api-cloud-read.sql", "utf8"), /api_keys_scope_check/);
assert.equal(readFileSync("docs/v2/club-api-cloud-read.sql", "utf8").includes("ALTER"), false);

console.log("club catalog assertions passed");
