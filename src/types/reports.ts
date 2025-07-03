
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

  // Validate each supplier item
  for (const supplier of data.suppliers_breakdown) {
    if (!supplier || typeof supplier !== 'object') {
      return false;
    }
    if (!('supplier_id' in supplier) || (supplier.supplier_id !== null && typeof supplier.supplier_id !== 'string')) {
      return false;
    }
    if (!('total_purchased' in supplier) || typeof supplier.total_purchased !== 'number') {
      return false;
    }
  }

  // Check timeline_breakdown array
  if (!('timeline_breakdown' in data) || !Array.isArray(data.timeline_breakdown)) {
    return false;
  }

  // Validate each timeline item
  for (const timeline of data.timeline_breakdown) {
    if (!timeline || typeof timeline !== 'object') {
      return false;
    }
    if (!('date' in timeline) || typeof timeline.date !== 'string') {
      return false;
    }
    if (!('sales' in timeline) || typeof timeline.sales !== 'number') {
      return false;
    }
  }

  return true;
}
