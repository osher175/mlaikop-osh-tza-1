/**
 * Export inventory to TSV for Excel compatibility
 * Separator: TAB (\t)
 * Encoding: UTF-8
 * Extension: .tsv
 */

interface ProductForExport {
  name: string;
  barcode?: string | null;
  product_categories?: { name: string } | null;
  suppliers?: { name: string } | null;
  supplier_id?: string | null;
  location?: string | null;
  quantity: number;
  cost?: number | null;
  updated_at?: string | null;
}

interface SupplierMap {
  [key: string]: string;
}

export const exportInventoryToCSV = (
  products: ProductForExport[],
  supplierMap?: SupplierMap
): void => {
  // TSV Header row (Hebrew)
  const headers = [
    'שם מוצר',
    'ברקוד',
    'קטגוריה',
    'ספק',
    'מיקום במלאי',
    'כמות במלאי',
    'עלות ליחידה (₪)',
    'שווי מלאי כולל (₪)',
    'תאריך עדכון אחרון'
  ];

  // Build rows
  const rows = products.map((product) => {
    const unitCost = product.cost ?? 0;
    const totalValue = product.quantity * unitCost;
    
    // Get supplier name from joined data or map
    let supplierName = '';
    if ((product as any).suppliers?.name) {
      supplierName = (product as any).suppliers.name;
    } else if (product.supplier_id && supplierMap?.[product.supplier_id]) {
      supplierName = supplierMap[product.supplier_id];
    }

    // Format date with time
    const updatedAt = product.updated_at 
      ? new Date(product.updated_at).toLocaleString('he-IL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';

    return [
      product.name || '',
      product.barcode || '',
      product.product_categories?.name || '',
      supplierName,
      product.location || '',
      product.quantity.toString(),
      unitCost.toFixed(2),
      totalValue.toFixed(2),
      updatedAt
    ];
  });

  // Escape TSV values (handle tabs and newlines)
  const escapeTSVValue = (value: string): string => {
    // Replace tabs and newlines with spaces to prevent column breaking
    return value.replace(/[\t\n\r]/g, ' ');
  };

  // Build TSV content with TAB separator
  const tsvContent = [
    headers.map(escapeTSVValue).join('\t'),
    ...rows.map(row => row.map(escapeTSVValue).join('\t'))
  ].join('\r\n');

  // Generate filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString()
    .replace('T', '_')
    .replace(/:/g, '-')
    .slice(0, 16); // YYYY-MM-DD_HH-mm
  const filename = `inventory_snapshot_${timestamp}.xls`;

  // Add UTF-8 BOM for Hebrew compatibility in Excel
  const BOM = '\uFEFF';
  const tsvWithBOM = BOM + tsvContent;

  // Create and trigger download
  const blob = new Blob([tsvWithBOM], { type: 'text/tab-separated-values;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
