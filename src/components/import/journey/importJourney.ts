/**
 * Import journey presentation model.
 *
 * IMPORTANT: no schema change. The journey is a *presentation* projection of the
 * existing, already-validated `import_orders.status` vocabulary. Milestone dates
 * are derived from the existing `import_events` rows (`status_changed`), so no
 * new tracking table or column is required.
 */
import type { ImportStatus } from '@/hooks/useImportOrders';

export interface JourneyMilestone {
  status: ImportStatus;
  label: string;
  icon: string;
  hint: string;
}

/** Ordered lifecycle. `cancelled` is intentionally out of the journey line. */
export const JOURNEY_MILESTONES: JourneyMilestone[] = [
  { status: 'ordered', label: 'ההזמנה אושרה', icon: '📝', hint: 'ההזמנה נמסרה לספק' },
  { status: 'preparing', label: 'בהכנה אצל הספק', icon: '🏭', hint: 'הספק מייצר או אורז את הסחורה' },
  { status: 'shipped', label: 'יצאה מהספק', icon: '🚢', hint: 'המשלוח יצא לדרך' },
  { status: 'in_transit', label: 'בדרך לישראל', icon: '🌊', hint: 'הסחורה בשילוח בינלאומי' },
  { status: 'arrived_israel', label: 'הגיעה לנמל בישראל', icon: '⚓', hint: 'המשלוח נחת/עגן בישראל' },
  { status: 'customs_clearance', label: 'בשחרור מהמכס', icon: '🛃', hint: 'עמיל המכס מטפל בשחרור' },
  { status: 'receiving', label: 'בהובלה לעסק', icon: '🚚', hint: 'הסחורה בדרך אליך' },
  { status: 'received_pending_costs', label: 'הגיעה לעסק', icon: '📦', hint: 'הסחורה אצלך — אפשר לקלוט למלאי' },
  { status: 'completed', label: 'תהליך היבוא נסגר', icon: '✅', hint: 'העלויות נסגרו והיבוא הושלם' },
];

export const journeyIndex = (status: string): number =>
  JOURNEY_MILESTONES.findIndex((m) => m.status === status);

export const journeyMilestone = (status: string): JourneyMilestone | undefined =>
  JOURNEY_MILESTONES.find((m) => m.status === status);

/** 0–100 progress along the journey; cancelled orders report 0. */
export const journeyProgress = (status: string): number => {
  if (status === 'cancelled') return 0;
  const idx = journeyIndex(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / JOURNEY_MILESTONES.length) * 100);
};

/**
 * Latest timestamp per status, taken from existing `status_changed` events.
 * Metadata key naming is read defensively — the events table is not modified.
 */
export const milestoneDates = (events: any[]): Record<string, string> => {
  const map: Record<string, string> = {};
  [...(events ?? [])]
    .filter((e) => e?.event_type === 'status_changed')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach((e) => {
      const m = e.metadata ?? {};
      const status = m.to ?? m.new_status ?? m.status ?? m.to_status;
      if (typeof status === 'string') map[status] = e.created_at;
    });
  return map;
};
