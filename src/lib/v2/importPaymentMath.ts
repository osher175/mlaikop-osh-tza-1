export interface ImportPaymentAmount {
  payment_status: string;
  amount_ils: number | null;
}

/** Paid rows only. Planned, pending and cancelled do not reduce the balance. */
export function paidImportIls(payments: ImportPaymentAmount[]): number {
  return payments
    .filter((payment) => payment.payment_status === 'paid')
    .reduce((sum, payment) => sum + Number(payment.amount_ils ?? 0), 0);
}

/** Recorded payment rows that are not marked paid. This is not the order balance. */
export function nonPaidImportIls(payments: ImportPaymentAmount[]): number {
  return payments
    .filter((payment) => payment.payment_status !== 'paid')
    .reduce((sum, payment) => sum + Number(payment.amount_ils ?? 0), 0);
}

/** Commercial ILS remainder. Goods receipt and this number are independent. */
export function orderPayableRemaining(goodsIls: number, expensesIls: number, paidIls: number): number {
  return goodsIls + expensesIls - paidIls;
}

/** A non-ILS amount without a rate must not be stored as if it were already shekels. */
export function foreignRateMissing(currencyCode: string, exchangeRate: string): boolean {
  return currencyCode !== 'ILS' && exchangeRate.trim() === '';
}
