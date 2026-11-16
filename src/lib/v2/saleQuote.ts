import { VAT_RATE, calculateNetFromGross, calculateVatFromGross } from '@/lib/financialConfig';
import type { DraftLine } from '@/lib/v2/saleDraft';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface SaleQuote {
  vatRate: number;
  units: number;
  /** VAT-inclusive. Null when any line has no sale price. */
  gross: number | null;
  net: number | null;
  vat: number | null;
  /** Ex-VAT cost of lines whose cost is known, including a genuine zero. Null when every cost is unknown. */
  knownCost: number | null;
  /** Ex-VAT profit of the known-cost lines only. Null when no line has a known cost. */
  knownProfit: number | null;
  /** Present only when every line has a price and a known cost. */
  marginPct: number | null;
  costComplete: boolean;
  unknownCostLines: number;
  missingPriceLines: number;
}

/**
 * Catalog `products.price` is the VAT-inclusive unit price, the same treatment as
 * `sale_total_ils`. The rate is the application financial configuration (Israel VAT),
 * snapshotted for the draft. There is no per-business tax table.
 * Unknown cost stays out of the profit figure.
 */
export function quoteDraft(lines: DraftLine[]): SaleQuote {
  let units = 0;
  let gross = 0;
  let knownCost = 0;
  let knownGross = 0;
  let unknownCostLines = 0;
  let missingPriceLines = 0;
  let knownLines = 0;

  for (const line of lines) {
    units += line.quantity;
    if (line.unitPriceGross === null || line.unitPriceGross < 0) {
      missingPriceLines += 1;
      continue;
    }
    const lineGross = round2(line.unitPriceGross * line.quantity);
    gross += lineGross;
    if (line.unitCost === null) {
      unknownCostLines += 1;
      continue;
    }
    knownLines += 1;
    knownCost += round2(line.unitCost * line.quantity);
    knownGross += lineGross;
  }

  const priced = missingPriceLines === 0 && lines.length > 0;
  const costComplete = priced && unknownCostLines === 0;
  const knownNet = calculateNetFromGross(knownGross);
  const knownProfit = knownLines > 0 ? round2(knownNet - knownCost) : null;
  const net = priced ? round2(calculateNetFromGross(gross)) : null;

  return {
    vatRate: VAT_RATE,
    units,
    gross: priced ? round2(gross) : null,
    net,
    vat: priced ? round2(calculateVatFromGross(gross)) : null,
    knownCost: knownLines > 0 ? round2(knownCost) : null,
    knownProfit,
    marginPct: costComplete && net !== null && net > 0 && knownProfit !== null ? (knownProfit / net) * 100 : null,
    costComplete,
    unknownCostLines,
    missingPriceLines,
  };
}
