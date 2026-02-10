export const OPEN_STATUSES = [
  'draft',
  'in_progress',
  'waiting_for_quotes',
  'quotes_received',
  'waiting_for_approval',
  'recommended',
] as const;

export const TERMINAL_STATUSES = [
  'ordered_external',
  'resolved_external',
  'cancelled',
  'ordered', // legacy/backward compatibility
] as const;
