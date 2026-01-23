/**
 * Financial Configuration Module
 * 
 * This module controls the financial tracking reset and annual measurement logic.
 * All financial calculations (Revenue, Profit, Discounts, Purchases, BI, Reports, Insights)
 * are filtered based on these settings.
 * 
 * Operational data (Dead Stock, Stockout Risk, inventory movements) uses full history.
 */

// Financial tracking start date - all financial calculations begin from this date
// Set to today's date (2025-01-23) as the reset point
export const FINANCIAL_TRACKING_START_AT = new Date('2025-01-23T00:00:00.000Z');

// VAT rate in Israel (18%)
export const VAT_RATE = 0.18;

/**
 * Get the financial tracking start date
 */
export const getFinancialTrackingStartDate = (): Date => {
  return FINANCIAL_TRACKING_START_AT;
};

/**
 * Get the start of a calendar year
 */
export const getYearStart = (year: number): Date => {
  return new Date(year, 0, 1, 0, 0, 0, 0);
};

/**
 * Get the end of a calendar year
 */
export const getYearEnd = (year: number): Date => {
  return new Date(year, 11, 31, 23, 59, 59, 999);
};

/**
 * Get the effective start date for financial calculations in a given year
 * Takes into account both the year start and the financial tracking start date
 */
export const getEffectiveFinancialStartDate = (year: number): Date => {
  const yearStart = getYearStart(year);
  const financialStart = getFinancialTrackingStartDate();
  
  // Use the later of the two dates
  return yearStart > financialStart ? yearStart : financialStart;
};

/**
 * Check if a date is within the financial tracking period
 */
export const isWithinFinancialTrackingPeriod = (date: Date | string): boolean => {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate >= FINANCIAL_TRACKING_START_AT;
};

/**
 * Check if a date is within a specific calendar year's financial period
 */
export const isWithinYearFinancialPeriod = (date: Date | string, year: number): boolean => {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const effectiveStart = getEffectiveFinancialStartDate(year);
  const yearEnd = getYearEnd(year);
  
  return checkDate >= effectiveStart && checkDate <= yearEnd;
};

/**
 * Calculate net amount from gross amount (remove VAT)
 * sale_total_ils includes VAT, so we need to extract the net value
 */
export const calculateNetFromGross = (grossAmount: number): number => {
  return grossAmount / (1 + VAT_RATE);
};

/**
 * Calculate VAT amount from gross amount
 */
export const calculateVatFromGross = (grossAmount: number): number => {
  return grossAmount - calculateNetFromGross(grossAmount);
};

/**
 * Calculate gross amount from net amount (add VAT)
 */
export const calculateGrossFromNet = (netAmount: number): number => {
  return netAmount * (1 + VAT_RATE);
};

/**
 * Get list of years available for financial comparison
 * Returns years from the financial tracking start to current year + optionally future years
 */
export const getAvailableFinancialYears = (includeFutureYears: number = 0): number[] => {
  const startYear = FINANCIAL_TRACKING_START_AT.getFullYear();
  const currentYear = new Date().getFullYear();
  const endYear = currentYear + includeFutureYears;
  
  const years: number[] = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  
  return years;
};

/**
 * Financial year data structure for YoY comparisons
 */
export interface YearlyFinancialData {
  year: number;
  totalRevenue: number;       // Gross revenue (with VAT)
  totalRevenueNet: number;    // Net revenue (without VAT)
  totalPurchases: number;
  grossProfit: number;
  netProfit: number;          // Gross profit minus VAT
  totalDiscounts: number;
  transactionCount: number;
}

/**
 * Month names in Hebrew
 */
export const MONTH_NAMES_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

/**
 * Configuration summary for display
 */
export const getFinancialConfigSummary = () => ({
  financialTrackingStartAt: FINANCIAL_TRACKING_START_AT.toISOString(),
  vatRate: VAT_RATE,
  vatRatePercent: VAT_RATE * 100,
  currentYear: new Date().getFullYear(),
  availableYears: getAvailableFinancialYears(),
});
