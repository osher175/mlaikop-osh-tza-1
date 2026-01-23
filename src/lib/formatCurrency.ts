/**
 * Centralized currency formatting utility for ILS (Israeli New Shekel)
 * All monetary values in the application should use this function
 */
export const formatCurrency = (amount: number, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(amount);
};

/**
 * Format currency with decimal places (for precise transaction amounts)
 */
export const formatCurrencyPrecise = (amount: number): string => {
  return formatCurrency(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
