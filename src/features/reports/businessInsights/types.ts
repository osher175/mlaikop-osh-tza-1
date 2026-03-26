export type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface BusinessInsight {
  id: string;
  type: 'profit_change' | 'top_product_dependency' | 'category_decline' | 'low_margin';
  severity: InsightSeverity;
  title: string;
  description: string;
  recommendation: string;
  value?: number;
  previousValue?: number;
  changePercent?: number;
}
