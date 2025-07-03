
export interface ReportsData {
  total_added: number;
  total_removed: number;
  total_value: number;
  gross_profit: number;
  net_profit: number;
  top_product: string | null;
  suppliers_breakdown: Array<{
    supplier_id: string | null;
    total_purchased: number;
  }>;
  timeline_breakdown: Array<{
    date: string;
    sales: number;
  }>;
}

export interface TopProduct {
  name: string;
  quantity: number;
}
