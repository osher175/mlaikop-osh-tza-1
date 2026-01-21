// Insight Types for Mlaiko Smart Insights

export type InsightType = 
  | 'low_margin'
  | 'high_discount'
  | 'dead_stock'
  | 'stockout_risk'
  | 'cost_spike'
  | 'business_health';

export type InsightSeverity = 'high' | 'medium' | 'low';

// Individual item in an insight list
export interface LowMarginItem {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
  grossProfit: number;
  marginPercent: number;
}

export interface HighDiscountItem {
  productId: string;
  productName: string;
  avgDiscountPercent: number;
  totalDiscountIls: number;
  salesCount: number;
}

export interface DeadStockItem {
  productId: string;
  productName: string;
  quantity: number;
  daysSinceLastSale: number | null; // null = never sold
  estimatedValue: number;
}

export interface StockoutRiskItem {
  productId: string;
  productName: string;
  currentQuantity: number;
  avgDailySales: number;
  daysCover: number;
}

export interface CostSpikeItem {
  productId: string;
  productName: string;
  avgCost90Days: number;
  avgCost30Days: number;
  changePercent: number;
  supplierName?: string;
}

export interface BusinessHealthMonth {
  month: string;
  monthIndex: number;
  totalRevenue: number;
  totalDiscounts: number;
  grossProfit: number;
  avgDiscountPercent: number;
}

export interface BusinessHealthInsight {
  months: BusinessHealthMonth[];
  warning: boolean;
  warningMessage?: string;
}

// Generic insight structure
export interface InsightItem<T = unknown> {
  type: InsightType;
  title: string;
  summary: string;
  severity: InsightSeverity;
  count: number;
  updatedAt: Date;
  items: T[];
}

// All insights combined
export interface InsightsData {
  lowMargin: InsightItem<LowMarginItem>;
  highDiscount: InsightItem<HighDiscountItem>;
  deadStock: InsightItem<DeadStockItem>;
  stockoutRisk: InsightItem<StockoutRiskItem>;
  costSpike: InsightItem<CostSpikeItem>;
  businessHealth: InsightItem<BusinessHealthMonth> & { warning: boolean; warningMessage?: string };
}

// Config for insights calculation
export interface InsightsConfig {
  lookbackSalesDays: number;
  lookbackPurchasesDays: number;
  stockoutDaysCoverThreshold: number;
  deadStockDays: number;
  highDiscountPercent: number;
  costIncreasePercent: number;
  lowMarginPercent: number;
}

export const DEFAULT_INSIGHTS_CONFIG: InsightsConfig = {
  lookbackSalesDays: 30,
  lookbackPurchasesDays: 90,
  stockoutDaysCoverThreshold: 7,
  deadStockDays: 60,
  highDiscountPercent: 25,
  costIncreasePercent: 10,
  lowMarginPercent: 10,
};
