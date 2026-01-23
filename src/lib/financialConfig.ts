/**
 * Financial Configuration Module
 * 
 * This module controls the financial tracking and annual measurement logic.
 * All financial calculations (Revenue, Profit, Discounts, Purchases, BI, Reports, Insights)
 * reset every January 1st at 00:00 for each calendar year.
 * 
 * Historical data is preserved for Year-over-Year (YoY) comparisons.
 * Operational data (Dead Stock, Stockout Risk, inventory movements) uses full history.
 */

// VAT rate in Israel (18%)
export const VAT_RATE = 0.18;

// Minimum year for financial data (system inception)
// This is used for YoY queries to avoid infinite lookback
export const FINANCIAL_DATA_MIN_YEAR = 2020;

/**
 * Get the start of a calendar year (January 1st at 00:00:00.000)
 * This is the financial reset point for each year
 */
export const getYearStart = (year: number): Date => {
  return new Date(year, 0, 1, 0, 0, 0, 0);
};

/**
 * Get the end of a calendar year (December 31st at 23:59:59.999)
 */
export const getYearEnd = (year: number): Date => {
  return new Date(year, 11, 31, 23, 59, 59, 999);
};

/**
 * Get the effective start date for financial calculations in a given year
 * Always returns January 1st of the given year - NO hardcoded dates
 * 
 * Each calendar year starts fresh from zero
 */
export const getEffectiveFinancialStartDate = (year: number): Date => {
  return getYearStart(year);
};

/**
 * Check if a date falls within a specific calendar year
 * Used for filtering financial data to the correct year
 */
export const isWithinCalendarYear = (date: Date | string, year: number): boolean => {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const yearStart = getYearStart(year);
  const yearEnd = getYearEnd(year);
  
  return checkDate >= yearStart && checkDate <= yearEnd;
};

/**
 * Alias for isWithinCalendarYear for backward compatibility
 */
export const isWithinYearFinancialPeriod = isWithinCalendarYear;

/**
 * Check if a date is within the financial tracking period
 * Now simply checks if the date is valid (any year from MIN_YEAR onward)
 */
export const isWithinFinancialTrackingPeriod = (date: Date | string): boolean => {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate.getFullYear() >= FINANCIAL_DATA_MIN_YEAR;
};

/**
 * Calculate net amount from gross amount (remove VAT)
 * sale_total_ils includes VAT, so we need to extract the net value
 * 
 * Formula: netProfit = (sum(sale_total_ils) / 1.18) - sum(cost_snapshot_ils × |quantity|)
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
 * Returns years from FINANCIAL_DATA_MIN_YEAR to current year + optional future years
 */
export const getAvailableFinancialYears = (includeFutureYears: number = 0): number[] => {
  const currentYear = new Date().getFullYear();
  const endYear = currentYear + includeFutureYears;
  
  const years: number[] = [];
  for (let year = FINANCIAL_DATA_MIN_YEAR; year <= endYear; year++) {
    years.push(year);
  }
  
  return years;
};

/**
 * Get relevant years for comparison (current year and previous years with data)
 * More practical for YoY - returns last N years
 */
export const getRelevantFinancialYears = (numYears: number = 3): number[] => {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  
  for (let i = 0; i < numYears; i++) {
    const year = currentYear - i;
    if (year >= FINANCIAL_DATA_MIN_YEAR) {
      years.push(year);
    }
  }
  
  return years.sort((a, b) => a - b);
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
  netProfit: number;          // Net profit = revenueNet - COGS
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
  vatRate: VAT_RATE,
  vatRatePercent: VAT_RATE * 100,
  currentYear: new Date().getFullYear(),
  minYear: FINANCIAL_DATA_MIN_YEAR,
  availableYears: getAvailableFinancialYears(),
  financialResetPolicy: 'Calendar year (January 1st)',
});
