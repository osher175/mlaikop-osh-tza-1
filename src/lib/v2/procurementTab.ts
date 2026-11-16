const TABS = ['shortages', 'requests', 'orders', 'settings'] as const;
export type ProcurementTab = (typeof TABS)[number];

/** V2 opens on purchase orders. Legacy stays on shortages. An explicit tab wins. */
export function procurementTab(v2: boolean, requested: string | null): ProcurementTab {
  if (requested && (TABS as readonly string[]).includes(requested)) {
    if (requested === 'orders' && !v2) return 'shortages';
    return requested as ProcurementTab;
  }
  return v2 ? 'orders' : 'shortages';
}
