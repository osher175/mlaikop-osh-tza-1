/**
 * Export inventory to native Excel XLSX format
 * Uses xlsx library for proper Excel compatibility
 * Full Hebrew RTL support
 */

import * as XLSX from 'xlsx';

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
  // Hebrew headers
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
      product.quantity,
      unitCost,
      totalValue,
      updatedAt
    ];
  });

  // Combine headers and rows
  const data = [headers, ...rows];

  // Create worksheet from array of arrays
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths for better readability
  ws['!cols'] = [
    { wch: 25 }, // שם מוצר
    { wch: 15 }, // ברקוד
    { wch: 15 }, // קטגוריה
    { wch: 18 }, // ספק
    { wch: 15 }, // מיקום במלאי
    { wch: 12 }, // כמות במלאי
    { wch: 18 }, // עלות ליחידה
    { wch: 18 }, // שווי מלאי כולל
    { wch: 20 }, // תאריך עדכון
  ];

  // Set RTL for Hebrew
  ws['!sheetViews'] = [{ rightToLeft: true }];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'מלאי');

  // Generate filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString()
    .replace('T', '_')
    .replace(/:/g, '-')
    .slice(0, 16); // YYYY-MM-DD_HH-mm
  const filename = `inventory_snapshot_${timestamp}.xlsx`;

  // Write and download file
  XLSX.writeFile(wb, filename);
};
