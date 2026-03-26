/**
 * Sales Dimensions — shared type definitions for the dynamic sales ranking widget.
 * 
 * Supported dimensions:
 *  - product: individual product SKU
 *  - brand: product brand
 *  - category: product category
 *  - supplier: supplier
 * 
 * Future: 'size' can be added when a `size` column exists on the products table.
 */

export type SalesDimension = 'product' | 'brand' | 'category' | 'supplier';

export interface SalesDimensionItem {
  key: string;
  label: string;
  quantity_sold: number;
  revenue: number;
}

export interface SalesDimensionConfig {
  value: SalesDimension;
  label: string;          // Hebrew label for UI
  title: string;          // Widget title in Hebrew
  subtitle: string;       // Widget subtitle in Hebrew
  emptyMessage: string;   // Empty state message
}

export const SALES_DIMENSIONS: SalesDimensionConfig[] = [
  {
    value: 'product',
    label: 'מוצר',
    title: 'מוצרי המכירה המובילים',
    subtitle: 'דירוג לפי הכנסות מכירה — שנה נוכחית (₪)',
    emptyMessage: 'אין נתוני מכירות מוצרים לתקופה',
  },
  {
    value: 'brand',
    label: 'מותג',
    title: 'המותגים המובילים במכירות',
    subtitle: 'דירוג מותגים לפי הכנסות מכירה — שנה נוכחית (₪)',
    emptyMessage: 'אין נתוני מכירות מותגים לתקופה',
  },
  {
    value: 'category',
    label: 'קטגוריה',
    title: 'הקטגוריות המובילות במכירות',
    subtitle: 'דירוג קטגוריות לפי הכנסות מכירה — שנה נוכחית (₪)',
    emptyMessage: 'אין נתוני מכירות קטגוריות לתקופה',
  },
  {
    value: 'supplier',
    label: 'ספק',
    title: 'הספקים המובילים במכירות',
    subtitle: 'דירוג ספקים לפי הכנסות מכירה — שנה נוכחית (₪)',
    emptyMessage: 'אין נתוני מכירות ספקים לתקופה',
  },
];

export const getDimensionConfig = (dimension: SalesDimension): SalesDimensionConfig => {
  return SALES_DIMENSIONS.find(d => d.value === dimension) ?? SALES_DIMENSIONS[0];
};
