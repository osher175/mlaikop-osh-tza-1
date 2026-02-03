
export interface TopProductItem {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

export interface PurchaseBreakdownItem {
  month: string;
  quantity: number;
  amount: number;
}

export interface ReportsData {
  total_added: number;
  total_removed: number;
  total_value: number;
  gross_profit: number;
  net_profit: number;
  top_product: string | null;
  suppliers_breakdown: Array<{
    supplier_id: string | null;
    supplier_name: string;
    total_purchased: number;
  }>;
  timeline_breakdown: Array<{
    date: string;
    sales: number;
    sales_amount?: number;
  }>;
  top_products_list: TopProductItem[];
  purchases_breakdown: PurchaseBreakdownItem[];
}

export interface TopProduct {
  name: string;
  quantity: number;
}

// Type guard function to validate ReportsData at runtime
export function isReportsData(data: any): data is ReportsData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required numeric fields
  const numericFields = ['total_added', 'total_removed', 'total_value', 'gross_profit', 'net_profit'];
  for (const field of numericFields) {
    if (!(field in data) || typeof data[field] !== 'number') {
      return false;
    }
  }

  // Check top_product (can be string or null)
  if (!('top_product' in data) || (data.top_product !== null && typeof data.top_product !== 'string')) {
    return false;
  }

  // Check suppliers_breakdown array
  if (!('suppliers_breakdown' in data) || !Array.isArray(data.suppliers_breakdown)) {
    return false;
  }

  // Check timeline_breakdown array
  if (!('timeline_breakdown' in data) || !Array.isArray(data.timeline_breakdown)) {
    return false;
  }

  // Check top_products_list array
  if (!('top_products_list' in data) || !Array.isArray(data.top_products_list)) {
    return false;
  }

  // Check purchases_breakdown array
  if (!('purchases_breakdown' in data) || !Array.isArray(data.purchases_breakdown)) {
    return false;
  }

  return true;
}
