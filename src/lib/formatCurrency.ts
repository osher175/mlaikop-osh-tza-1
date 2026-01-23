/**
 * Centralized currency formatting utility for ILS (Israeli New Shekel)
 * All monetary values in the application should use this function
 */
export const formatCurrency = (amount: number | null | undefined, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string => {
  // Handle null, undefined, or NaN
  const safeAmount = (amount == null || isNaN(amount)) ? 0 : amount;
  
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(safeAmount);
};

/**
 * Format currency with decimal places (for precise transaction amounts)
 */
export const formatCurrencyPrecise = (amount: number | null | undefined): string => {
  return formatCurrency(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
