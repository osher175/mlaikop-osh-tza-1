import type { DashboardFilters, DashboardPeriod } from './importDashboardMetrics.ts';

const CENTER_SEARCH_KEY = 'mlaiko.import.centerSearch';

export const IMPORT_ORDER_TABS = [
  'products',
  'payments',
  'shipping',
  'expenses',
  'receipts',
  'documents',
  'history',
] as const;

export type ImportOrderTab = (typeof IMPORT_ORDER_TABS)[number];

/**
 * I5 receiving navigation, not implemented here.
 * Enter only from an eligible shipment or order, and keep both ids.
 * A container may hold several orders, and a shipment may be partial.
 * Return to the order or shipment the user came from.
 * Posting must not run twice, and existing receipt history stays in place.
 * I3 has no route for this screen.
 */
export const FUTURE_RECEIVING_LABEL = 'קליטת סחורה חדשה — בקרוב';

const PERIODS = new Set<DashboardPeriod>(['all', '30', '90', 'year']);

export function filtersFromSearch(search: string): DashboardFilters {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const period = params.get('period');
  return {
    search: params.get('q') ?? '',
    status: params.get('status') ?? '',
    supplierId: params.get('supplier') ?? '',
    period: period && PERIODS.has(period as DashboardPeriod) ? period as DashboardPeriod : 'all',
  };
}

export function filtersToSearch(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('q', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.supplierId) params.set('supplier', filters.supplierId);
  if (filters.period !== 'all') params.set('period', filters.period);
  return params.toString();
}

export function centerHrefFromSearch(search: string): string {
  const qs = search.replace(/^\?/, '').trim();
  return qs ? `/import?${qs}` : '/import';
}

/** Order details always use the record id. The visible import number is not a route key. */
export function orderHref(orderId: string, tab?: string | null): string {
  const params = new URLSearchParams();
  if (tab && tab !== 'products' && (IMPORT_ORDER_TABS as readonly string[]).includes(tab)) {
    params.set('tab', tab);
  }
  const qs = params.toString();
  return qs ? `/import/${orderId}?${qs}` : `/import/${orderId}`;
}

export function orderTabFromSearch(search: string): ImportOrderTab {
  const tab = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('tab');
  return (IMPORT_ORDER_TABS as readonly string[]).includes(tab ?? '')
    ? tab as ImportOrderTab
    : 'products';
}

export function rememberImportCenterSearch(search: string): void {
  try {
    sessionStorage.setItem(CENTER_SEARCH_KEY, search.replace(/^\?/, ''));
  } catch {
    /* The explicit back link falls back to /import. */
  }
}

export function rememberedImportCenterHref(): string {
  try {
    return centerHrefFromSearch(sessionStorage.getItem(CENTER_SEARCH_KEY) ?? '');
  } catch {
    return '/import';
  }
}
