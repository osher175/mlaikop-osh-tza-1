
import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, Eye, Package } from 'lucide-react';
import { SearchLoadingState } from './SearchLoadingState';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
  product_categories?: { name: string } | null;
};

interface OptimizedInventoryTableProps {
  products: Product[];
  isLoading: boolean;
  isEmpty: boolean;
  hasError: boolean;
  searchTerm: string;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onViewProductImage: (product: Product) => void;
}

const ProductRow = memo(({ 
  product, 
  onEditProduct, 
  onDeleteProduct, 
  onViewProductImage 
}: {
  product: Product;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onViewProductImage: (product: Product) => void;
}) => {
  const getStockStatusColor = (quantity: number) => {
    if (quantity === 0) return 'text-red-600 bg-red-50';
    if (quantity <= 5) return 'text-amber-600 bg-amber-50';
    return 'text-green-600 bg-green-50';
  };

  const formatPrice = (price: number | null) => {
    if (!price) return '---';
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(price);
  };

  return (
    <TableRow className="hover:bg-gray-50 transition-colors duration-150">
      <TableCell className="font-medium text-right">
        <div className="flex items-center gap-2">
          {product.image && (
            <button
              onClick={() => onViewProductImage(product)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <Eye className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <span className="truncate max-w-[200px]">{product.name}</span>
        </div>
      </TableCell>
      
      <TableCell className="text-right">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStockStatusColor(product.quantity)}`}>
          {product.quantity} יח׳
        </span>
      </TableCell>
      
      <TableCell className="text-right">
        {product.product_categories?.name || '---'}
      </TableCell>
      
      <TableCell className="text-right">
        {product.location || '---'}
      </TableCell>
      
      <TableCell className="text-right">
        {formatPrice(product.price)}
      </TableCell>
      
      <TableCell className="text-right">
        {product.expiration_date 
          ? new Date(product.expiration_date).toLocaleDateString('he-IL')
          : '---'
        }
      </TableCell>
      
      <TableCell className="text-right">
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEditProduct(product)}
            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteProduct(product)}
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

ProductRow.displayName = 'ProductRow';

export const OptimizedInventoryTable: React.FC<OptimizedInventoryTableProps> = memo(({
  products,
  isLoading,
  isEmpty,
  hasError,
  searchTerm,
  onEditProduct,
  onDeleteProduct,
  onViewProductImage
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            רשימת מוצרים
            {!isLoading && products.length > 0 && (
              <span className="text-sm font-normal text-gray-500 mr-2">
                ({products.length} מוצרים)
              </span>
            )}
          </h3>
        </div>
      </div>

      <div style={{ minHeight: '400px' }}>
        <SearchLoadingState
          isLoading={isLoading}
          isEmpty={isEmpty}
          hasError={hasError}
          searchTerm={searchTerm}
        />

        {!isLoading && !hasError && products.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-right font-semibold">שם המוצר</TableHead>
                  <TableHead className="text-right font-semibold">כמות</TableHead>
                  <TableHead className="text-right font-semibold">קטגוריה</TableHead>
                  <TableHead className="text-right font-semibold">מיקום</TableHead>
                  <TableHead className="text-right font-semibold">מחיר</TableHead>
                  <TableHead className="text-right font-semibold">תפוגה</TableHead>
                  <TableHead className="text-right font-semibold">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onEditProduct={onEditProduct}
                    onDeleteProduct={onDeleteProduct}
                    onViewProductImage={onViewProductImage}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
});

OptimizedInventoryTable.displayName = 'OptimizedInventoryTable';
