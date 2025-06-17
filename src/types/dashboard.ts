
export interface DashboardSummary {
  totalProducts: number;
  lowStockCount: number;
  expiredCount: number;
  monthlyProfit: number;
}

export interface DashboardNotification {
  id: string;
  title: string;
  message: string;
  type: 'low_stock' | 'expired' | 'plan_limit' | 'custom';
  created_at: string;
  is_read: boolean;
  product_id?: string;
}

export interface MonthlyData {
  month: string;
  revenue: number;
}
