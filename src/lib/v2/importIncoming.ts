export interface IncomingLine {
  productId: string;
  ordered: number;
  received: number;
  notArriving: number;
  itemStatus: string;
  orderStatus: string;
  estimatedArrival: string | null;
}

export interface IncomingSummary {
  productId: string;
  outstanding: number;
  earliestArrival: string | null;
  arrivalCount: number;
}

const CLOSED = new Set(['completed', 'cancelled']);

export function outstandingQuantity(line: Pick<IncomingLine, 'ordered' | 'received' | 'notArriving'>): number {
  return Math.max(0, line.ordered - line.received - line.notArriving);
}

/** Incoming quantity is derived from open order lines. It is not a stored product flag. */
export function summarizeIncoming(lines: IncomingLine[]): IncomingSummary[] {
  const grouped = new Map<string, IncomingLine[]>();
  lines.forEach((line) => {
    if (!line.productId) return;
    if (line.itemStatus === 'cancelled') return;
    if (CLOSED.has(line.orderStatus)) return;
    if (outstandingQuantity(line) <= 0) return;
    const bucket = grouped.get(line.productId) ?? [];
    bucket.push(line);
    grouped.set(line.productId, bucket);
  });

  return [...grouped.entries()].map(([productId, rows]) => {
    const dates = [...new Set(rows.map((row) => row.estimatedArrival).filter((date): date is string => !!date))].sort();
    return {
      productId,
      outstanding: rows.reduce((sum, row) => sum + outstandingQuantity(row), 0),
      earliestArrival: dates[0] ?? null,
      arrivalCount: dates.length,
    };
  });
}

export function formatArrivalLabel(summary: Pick<IncomingSummary, 'earliestArrival' | 'arrivalCount'> | null): string | null {
  if (!summary?.earliestArrival) return null;
  const [year, month, day] = summary.earliestArrival.split('-');
  if (!year || !month || !day) return null;
  const date = `${day}.${month}.${year}`;
  if (summary.arrivalCount > 1) return `צפי כניסה למלאי: ${date} · ההגעה המוקדמת מתוך ${summary.arrivalCount}`;
  return `צפי כניסה למלאי: ${date}`;
}

export type QuantityRead =
  | { status: 'ok'; summary: IncomingSummary | null }
  | { status: 'unavailable' };

export type TransitRead =
  | { status: 'ok'; quantity: number }
  | { status: 'unavailable' };

/** A failed read is unavailable. A successful zero stays null and does not invent a date. */
export function incomingForCatalog(summaryRead: QuantityRead, transitRead: TransitRead): IncomingSummary | null | 'unavailable' {
  if (summaryRead.status === 'ok' && summaryRead.summary && summaryRead.summary.outstanding > 0) return summaryRead.summary;
  if (transitRead.status === 'ok' && transitRead.quantity > 0) {
    return {
      productId: summaryRead.status === 'ok' ? summaryRead.summary?.productId ?? '' : '',
      outstanding: transitRead.quantity,
      earliestArrival: null,
      arrivalCount: 0,
    };
  }
  if (summaryRead.status === 'unavailable' && transitRead.status === 'unavailable') return 'unavailable';
  return null;
}

export function catalogStockView(input: { quantity: number; incoming: IncomingSummary | null | 'unavailable' }): {
  showQuantity: boolean;
  incomingLabel: string | null;
  arrivalLabel: string | null;
  incomingUnknown: boolean;
} {
  if (input.incoming === 'unavailable') {
    return { showQuantity: true, incomingLabel: null, arrivalLabel: null, incomingUnknown: true };
  }
  const incoming = input.incoming && input.incoming.outstanding > 0 ? input.incoming : null;
  if (!incoming) return { showQuantity: true, incomingLabel: null, arrivalLabel: null, incomingUnknown: false };
  return {
    showQuantity: input.quantity > 0,
    incomingLabel: 'בדרך',
    arrivalLabel: formatArrivalLabel(incoming),
    incomingUnknown: false,
  };
}
