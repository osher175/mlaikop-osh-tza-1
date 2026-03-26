import { ReportsData } from '@/types/reports';
import { BusinessInsight } from './types';

/**
 * All insight rules receive the SAME reportsData that powers
 * summary cards, charts, and tables — no independent data fetching.
 */

export function profitChangeRule(
  current: ReportsData,
  previous: ReportsData | null,
): BusinessInsight | null {
  if (!previous) return null;

  const curr = current.net_profit;
  const prev = previous.net_profit;

  // Skip if both periods have no activity
  if (curr === 0 && prev === 0) return null;

  const change = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : curr > 0 ? 100 : -100;

  if (Math.abs(change) < 5) return null; // ignore <5% changes

  const isGrowth = change > 0;

  return {
    id: 'profit_change',
    type: 'profit_change',
    severity: isGrowth ? 'positive' : change < -20 ? 'critical' : 'warning',
    title: isGrowth ? 'עלייה ברווח הנקי' : 'ירידה ברווח הנקי',
    description: `הרווח הנקי ${isGrowth ? 'עלה' : 'ירד'} ב-${Math.abs(change).toFixed(1)}% לעומת התקופה הקודמת`,
    recommendation: isGrowth
      ? 'המשיכו בקו הנוכחי — בדקו אילו מוצרים תרמו לעלייה'
      : 'בדקו אילו מוצרים או ספקים גורמים לירידה ברווחיות',
    value: curr,
    previousValue: prev,
    changePercent: change,
  };
}

export function topProductDependencyRule(current: ReportsData): BusinessInsight | null {
  const products = current.top_products_list;
  if (!products || products.length < 2) return null;

  const totalRevenue = products.reduce((sum, p) => sum + (p.revenue || 0), 0);
  if (totalRevenue === 0) return null;

  const top = products[0];
  const share = (top.revenue / totalRevenue) * 100;

  if (share < 25) return null;

  return {
    id: 'top_product_dependency',
    type: 'top_product_dependency',
    severity: share > 50 ? 'critical' : 'warning',
    title: 'תלות גבוהה במוצר מוביל',
    description: `"${top.product_name}" מהווה ${share.toFixed(0)}% מסך ההכנסות בתקופה`,
    recommendation: 'גוונו את מגוון המכירות כדי להפחית סיכון מתלות במוצר בודד',
    value: share,
  };
}

export function lowMarginRule(current: ReportsData): BusinessInsight | null {
  const { gross_profit, total_value } = current;

  // total_value here represents revenue from sales
  if (total_value === 0 || gross_profit === 0) return null;

  // If gross profit is very low relative to total outgoing revenue
  const margin = (gross_profit / total_value) * 100;

  if (margin > 15 || margin < 0) return null; // only alert on thin positive margins

  return {
    id: 'low_margin',
    type: 'low_margin',
    severity: margin < 5 ? 'critical' : 'warning',
    title: 'מרווח רווח נמוך',
    description: `המרווח הגולמי עומד על ${margin.toFixed(1)}% בלבד בתקופה הנבחרת`,
    recommendation: 'בחנו הפחתת עלויות רכש או עדכון מחירי מכירה',
    value: margin,
  };
}

export function categoryDeclineRule(
  current: ReportsData,
  previous: ReportsData | null,
): BusinessInsight | null {
  if (!previous) return null;

  const currSuppliers = current.suppliers_breakdown;
  const prevSuppliers = previous.suppliers_breakdown;

  if (!currSuppliers?.length || !prevSuppliers?.length) return null;

  // Compare supplier totals as proxy for category performance
  for (const prevSup of prevSuppliers) {
    if (prevSup.total_purchased === 0) continue;

    const currSup = currSuppliers.find(s => s.supplier_id === prevSup.supplier_id);
    const currTotal = currSup?.total_purchased ?? 0;

    const change = ((currTotal - prevSup.total_purchased) / prevSup.total_purchased) * 100;

    if (change < -30) {
      return {
        id: `category_decline_${prevSup.supplier_id}`,
        type: 'category_decline',
        severity: change < -50 ? 'critical' : 'warning',
        title: `ירידה חדה ברכישות מ"${prevSup.supplier_name}"`,
        description: `ירידה של ${Math.abs(change).toFixed(0)}% ברכישות מספק זה לעומת התקופה הקודמת`,
        recommendation: 'בדקו האם מדובר בשינוי מכוון או בבעיית אספקה',
        changePercent: change,
      };
    }
  }

  return null;
}

/**
 * Run all rules and return aggregated insights.
 */
export function computeBusinessInsights(
  current: ReportsData,
  previous: ReportsData | null,
): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const rules = [
    () => profitChangeRule(current, previous),
    () => topProductDependencyRule(current),
    () => lowMarginRule(current),
    () => categoryDeclineRule(current, previous),
  ];

  for (const rule of rules) {
    const result = rule();
    if (result) insights.push(result);
  }

  // Sort by severity: critical > warning > info > positive
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return insights;
}
