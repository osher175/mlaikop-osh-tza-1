import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { rangeToUtc, type DayRange } from '@/lib/v2/dashboardMetrics';
import { V2_REPORTS_SQL_READY } from '@/lib/v2/reportFlags';

export interface EmployeeSalesBucket {
  revenueGross: number;
  grossProfit: number | null;
  units: number;
  transactions: number;
  unknownCostRevenue: number;
}

export interface EmployeeSalesRow extends EmployeeSalesBucket {
  employeeId: string;
}

export interface EmployeeSalesReport {
  revenueGross: number;
  grossProfit: number | null;
  vat: number;
  unknownCostRevenue: number;
  units: number;
  transactions: number;
  customerReturnUnits: number;
  employees: EmployeeSalesRow[];
  /** Historical and other sales stored without salesperson_employee_id. Never an invented employee. */
  unattributed: EmployeeSalesBucket;
}

const closed = 'דוח המכירות לפי עובד כבוי. לא נקרא דוח ולא שויך עובד.';

const money = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const bucket = (value: unknown): EmployeeSalesBucket | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const revenue = money(row.revenue_gross);
  const units = money(row.units);
  const transactions = money(row.transactions);
  const unknown = money(row.unknown_cost_revenue);
  if (revenue === null || units === null || transactions === null || unknown === null) return null;
  const profit = row.gross_profit;
  if (profit !== null && money(profit) === null) return null;
  return {
    revenueGross: revenue,
    grossProfit: profit === null ? null : money(profit),
    units,
    transactions,
    unknownCostRevenue: unknown,
  };
};

/** Rejects a payload that hides unattributed sales or treats a missing profit as zero. */
export function readEmployeeSalesReport(value: Json | null): EmployeeSalesReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const unattributed = bucket(row.unattributed);
  const revenue = money(row.revenue_gross);
  const vat = money(row.vat);
  const unknown = money(row.unknown_cost_revenue);
  const units = money(row.units);
  const transactions = money(row.transactions);
  const returns = money(row.customer_return_units);
  if (!unattributed || revenue === null || vat === null || unknown === null || units === null || transactions === null || returns === null) return null;
  const profit = row.gross_profit;
  if (profit !== null && money(profit) === null) return null;
  if (!Array.isArray(row.employees)) return null;
  const employees: EmployeeSalesRow[] = [];
  for (const item of row.employees) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const id = (item as { employee_id?: unknown }).employee_id;
    const parsed = bucket(item);
    if (typeof id !== 'string' || id.length === 0 || !parsed) return null;
    employees.push({ employeeId: id, ...parsed });
  }
  return {
    revenueGross: revenue,
    grossProfit: profit === null ? null : money(profit),
    vat,
    unknownCostRevenue: unknown,
    units,
    transactions,
    customerReturnUnits: returns,
    employees,
    unattributed,
  };
}

/** Refuses before any request while the report flag is off. */
export async function loadEmployeeSalesReport(businessId: string, range: DayRange): Promise<EmployeeSalesReport> {
  if (!V2_REPORTS_SQL_READY) throw new Error(closed);
  const { start, endExclusive } = rangeToUtc(range);
  const { data, error } = await supabase.rpc('employee_sales_report', {
    p_business_id: businessId,
    p_from: start,
    p_to: endExclusive,
  });
  if (error) throw error;
  const report = readEmployeeSalesReport(data);
  if (!report) throw new Error('הדוח לא הושלם. לא מוצג רווח מחושב.');
  return report;
}
