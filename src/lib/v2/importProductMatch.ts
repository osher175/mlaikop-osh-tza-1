export interface TireIdentity {
  businessId: string;
  productId?: string | null;
  brand: string;
  model: string;
  width: number;
  aspect: number;
  rim: number;
  loadIndex: number | null;
  speedRating: string | null;
  sku: string | null;
}

export interface CatalogIdentity extends TireIdentity {
  productId: string;
}

export type MatchResult =
  | { status: 'selected'; productId: string }
  | { status: 'matched'; productId: string }
  | { status: 'none' }
  | { status: 'ambiguous'; productIds: string[] };

export function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function identityKey(tire: Omit<TireIdentity, 'businessId' | 'productId' | 'sku'>): string {
  const speed = normalizeToken(tire.speedRating ?? '').toUpperCase();
  return [
    normalizeToken(tire.brand),
    normalizeToken(tire.model),
    tire.width,
    tire.aspect,
    tire.rim.toFixed(1),
    tire.loadIndex ?? '',
    speed,
  ].join('|');
}

/**
 * Explicit id wins. One SKU is reused only when the full identity agrees.
 * A conflicting SKU, or more than one candidate, stays ambiguous.
 * Tire size alone is never enough. Different businesses are ignored.
 */
export function matchTire(input: TireIdentity, catalog: CatalogIdentity[]): MatchResult {
  const selected = input.productId?.trim();
  if (selected) {
    const found = catalog.find((item) => item.productId === selected && item.businessId === input.businessId);
    return found ? { status: 'selected', productId: found.productId } : { status: 'none' };
  }

  const sameBusiness = catalog.filter((item) => item.businessId === input.businessId);
  const sku = normalizeToken(input.sku ?? '');
  const key = identityKey(input);
  if (sku) {
    const bySku = sameBusiness.filter((item) => normalizeToken(item.sku ?? '') === sku);
    if (bySku.length > 1) return { status: 'ambiguous', productIds: bySku.map((item) => item.productId) };
    if (bySku.length === 1) {
      if (identityKey(bySku[0]) !== key) {
        return { status: 'ambiguous', productIds: [bySku[0].productId] };
      }
      return { status: 'matched', productId: bySku[0].productId };
    }
  }

  const byIdentity = sameBusiness.filter((item) => identityKey(item) === key);
  if (byIdentity.length === 1) return { status: 'matched', productId: byIdentity[0].productId };
  if (byIdentity.length > 1) return { status: 'ambiguous', productIds: byIdentity.map((item) => item.productId) };
  return { status: 'none' };
}

export interface LegacyTireRecord {
  businessId: string;
  productId: string;
  brand: string | null;
  model: string | null;
  sizeLabel: string | null;
  loadIndex: string | null;
  speedRating: string | null;
}

const SIZE = /^(\d+)\/(\d+)R(\d+(?:\.\d)?)$/i;

function sameText(left: string, right: string): boolean {
  return normalizeToken(left) === normalizeToken(right);
}

/**
 * A stored purchase-order line can identify a catalog product that has no import identity.
 * Every attribute must be present and equal. A product name is not a record.
 */
export function matchLegacyCatalog(input: TireIdentity, records: LegacyTireRecord[]): MatchResult {
  if (input.loadIndex == null || !input.speedRating?.trim()) return { status: 'none' };
  const speed = input.speedRating.trim().toUpperCase();
  if (!/^[A-Z]{1,2}$/.test(speed)) return { status: 'none' };
  const hits = new Set<string>();
  records.forEach((record) => {
    if (record.businessId !== input.businessId || !record.productId) return;
    if (!record.brand || !record.model || !sameText(record.brand, input.brand) || !sameText(record.model, input.model)) return;
    if (!record.loadIndex || !/^[1-9][0-9]{0,2}$/.test(record.loadIndex) || Number(record.loadIndex) !== input.loadIndex) return;
    const recordSpeed = record.speedRating?.trim().toUpperCase() ?? '';
    if (!/^[A-Z]{1,2}$/.test(recordSpeed) || recordSpeed !== speed) return;
    const size = record.sizeLabel?.replace(/\s+/g, '').toUpperCase() ?? '';
    const parsed = SIZE.exec(size);
    if (!parsed) return;
    const rim = Number(parsed[3]);
    if (Number(parsed[1]) !== input.width || Number(parsed[2]) !== input.aspect || rim.toFixed(1) !== input.rim.toFixed(1)) return;
    hits.add(record.productId);
  });
  if (hits.size === 1) return { status: 'matched', productId: [...hits][0] };
  if (hits.size > 1) return { status: 'ambiguous', productIds: [...hits] };
  return { status: 'none' };
}
