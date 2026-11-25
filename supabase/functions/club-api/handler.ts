import {
  CLUB_SCOPE,
  incomingCursor,
  jerusalemDate,
  pageItems,
  pageLimit,
  selectIncoming,
  selectInStock,
  type IncomingSourceRow,
  type StockSourceRow,
} from "./catalog.ts";

export interface ClubKey {
  id: string;
  businessId: string;
  revokedAt: string | null;
  expiresAt: string | null;
  scope: string;
  rateLimitPerMin: number | null;
}

export interface ClubDeps {
  findKey: (apiKey: string) => Promise<ClubKey | null>;
  recentUseCount: (apiKeyId: string, sinceIso: string) => Promise<number>;
  logUse: (apiKeyId: string, businessId: string, endpoint: string, status: number) => Promise<void>;
  loadStock: (businessId: string) => Promise<StockSourceRow[]>;
  loadIncoming: (businessId: string) => Promise<IncomingSourceRow[]>;
}

export class ClubSourceError extends Error {
  constructor(readonly sourceCode: "stock_unavailable" | "incoming_unavailable") {
    super(sourceCode);
  }
}

const failure = (code: string, status: number) => ({
  status,
  body: { error: code, code },
});

export async function handleClubRequest(input: {
  method: string;
  path: string;
  apiKey: string | null;
  searchParams: URLSearchParams;
  now: Date;
  deps: ClubDeps;
}): Promise<{ status: number; body: unknown }> {
  if (input.method === "OPTIONS") return { status: 204, body: null };
  if (input.method !== "GET") return failure("method_not_allowed", 405);
  if (!input.apiKey) return failure("unauthorized", 401);

  const key = await input.deps.findKey(input.apiKey);
  if (!key || key.revokedAt || (key.expiresAt && new Date(key.expiresAt) < input.now)) {
    return failure("unauthorized", 401);
  }
  if (key.scope !== CLUB_SCOPE) return failure("scope_mismatch", 401);

  const perMinute = key.rateLimitPerMin ?? 60;
  const since = new Date(input.now.getTime() - 60_000).toISOString();
  if (await input.deps.recentUseCount(key.id, since) >= perMinute) {
    await input.deps.logUse(key.id, key.businessId, input.path, 429);
    return failure("rate_limited", 429);
  }

  const businessId = key.businessId;
  const limit = pageLimit(input.searchParams.get("limit"));
  const after = input.searchParams.get("after") || null;
  const generatedAt = input.now.toISOString();

  try {
    if (input.path === "/" || input.path === "") {
      await input.deps.logUse(key.id, businessId, input.path, 200);
      return {
        status: 200,
        body: {
          name: "Mlaiko club read API",
          read_only: true,
          generated_at: generatedAt,
          collections: ["in_stock", "incoming"],
          endpoints: ["GET /in-stock", "GET /incoming"],
        },
      };
    }
    if (input.path === "/in-stock") {
      const rows = await input.deps.loadStock(businessId);
      const page = pageItems(selectInStock(rows), after, limit, (item) => item.product_id);
      if (!page.cursorFound) {
        await input.deps.logUse(key.id, businessId, input.path, 409);
        return failure("cursor_not_found", 409);
      }
      await input.deps.logUse(key.id, businessId, input.path, 200);
      return {
        status: 200,
        body: {
          collection: "in_stock",
          generated_at: generatedAt,
          quantity_meaning: "physical_on_hand",
          reservation_meaning: "not_available_to_reserve",
          data: page.data,
          next_after: page.next_after,
          limit,
        },
      };
    }
    if (input.path === "/incoming") {
      const rows = await input.deps.loadIncoming(businessId);
      const page = pageItems(selectIncoming(rows, jerusalemDate(input.now)), after, limit, incomingCursor);
      if (!page.cursorFound) {
        await input.deps.logUse(key.id, businessId, input.path, 409);
        return failure("cursor_not_found", 409);
      }
      await input.deps.logUse(key.id, businessId, input.path, 200);
      return {
        status: 200,
        body: {
          collection: "incoming",
          generated_at: generatedAt,
          quantity_meaning: "remaining_not_yet_received",
          expected_on_kind: "date",
          data: page.data,
          next_after: page.next_after,
          limit,
        },
      };
    }
    await input.deps.logUse(key.id, businessId, input.path, 404);
    return failure("not_found", 404);
  } catch (error) {
    const code = error instanceof ClubSourceError ? error.sourceCode : "internal_error";
    const status = code === "internal_error" ? 500 : 503;
    await input.deps.logUse(key.id, businessId, input.path, status);
    return failure(code, status);
  }
}
