import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { LazyImage } from '@/components/inventory/LazyImage';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
  product_categories?: { name: string } | null;
  product_thresholds?: { low_stock_threshold: number } | null;
};

interface InventoryTableProps {
  products: Product[];
  searchTerm: string;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onViewProductImage: (product: Product) => void;
  activeStockFilter: 'all' | 'inStock' | 'lowStock' | 'outOfStock';
}

export const InventoryTable: React.FC<InventoryTableProps> = React.memo(({
  products,
  searchTerm,
  onEditProduct,
  onDeleteProduct,
  onViewProductImage,
  activeStockFilter,
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const getStatusBadge = (product: Product) => {
    const quantity = product.quantity;
    const threshold = product.product_thresholds?.low_stock_threshold || 5;
    
    if (quantity === 0) {
      return <Badge className="bg-red-500 text-white text-xs">אזל</Badge>;
    } else if (quantity <= threshold && quantity > 0) {
      return <Badge className="bg-yellow-500 text-white flex items-center gap-1 text-xs">
        <AlertTriangle className="w-3 h-3" />
        נמוך
      </Badge>;
    } else {
      return <Badge className="bg-green-500 text-white text-xs">במלאי</Badge>;
    }
  };

  const isLowStock = (product: Product) => {
    const quantity = product.quantity;
    const threshold = product.product_thresholds?.low_stock_threshold || 5;
    return quantity > 0 && quantity <= threshold;
  };

  const getCategoryName = (product: Product) => {
    return product.product_categories?.name || '-';
  };

  // Filter products by search term first
  const searchFilteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm)) ||
    (product.location && product.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Then filter by stock status
  const filteredProducts = searchFilteredProducts.filter(product => {
    const quantity = product.quantity;
    const threshold = product.product_thresholds?.low_stock_threshold || 5;
    
    switch (activeStockFilter) {
      case 'inStock':
        return quantity > threshold;
      case 'lowStock':
        return quantity > 0 && quantity <= threshold;
      case 'outOfStock':
        return quantity === 0;
      case 'all':
      default:
        return true;
    }
  });

  const getFilterTitle = () => {
    switch (activeStockFilter) {
      case 'inStock':
        return 'מוצרים במלאי';
      case 'lowStock':
        return 'מוצרים במלאי נמוך';
      case 'outOfStock':
        return 'מוצרים שאזלו';
      case 'all':
      default:
        return 'רשימת מוצרים';
    }
  };

  // Mobile optimized card view
  if (isMobile) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{getFilterTitle()} ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4 text-sm">
                {searchTerm || activeStockFilter !== 'all' 
                  ? 'לא נמצאו מוצרים מתאימים' 
                  : 'עדיין לא נוספו מוצרים'}
              </p>
              {!searchTerm && activeStockFilter === 'all' && (
                <Button 
                  className="w-full h-12" 
                  onClick={() => navigate('/add-product')}
                >
                  הוסף מוצר ראשון
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {filteredProducts.map((product) => (
                <Card 
                  key={product.id} 
                  className={`${isLowStock(product) ? 'border-l-4 border-l-yellow-500 shadow-sm' : 'shadow-sm'}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3 mb-3">
                      <LazyImage
                        src={product.image}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0"
                        onClick={() => onViewProductImage(product)}
                        title="לחץ לצפייה בתמונה מוגדלת"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {product.name}
                        </h3>
                        <p className="text-xs text-gray-600 truncate">
                          {getCategoryName(product)}
                        </p>
                        {product.barcode && (
                          <p className="text-xs text-gray-500 truncate">
                            {product.barcode}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(product)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="truncate">
                        <span className="text-gray-600">כמות: </span>
                        <span className="font-medium">{product.quantity}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-gray-600">מחיר: </span>
                        <span className="font-medium">₪{product.price || '-'}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-gray-600">מיקום: </span>
                        <span className="font-medium">{product.location || '-'}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-gray-600">עלות: </span>
                        <span className="font-medium">₪{product.cost || '-'}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onEditProduct(product)}
                        className="flex-1 h-8 text-xs"
                        title="ערוך מוצר"
                      >
                        <Edit className="w-3 h-3 ml-1" />
                        ערוך
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700 h-8 px-2"
                        onClick={() => onDeleteProduct(product)}
                        title="מחק מוצר"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Desktop table view - optimized
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{getFilterTitle()} ({filteredProducts.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm || activeStockFilter !== 'all' 
                ? 'לא נמצאו מוצרים מתאימים' 
                : 'עדיין לא נוספו מוצרים'}
            </p>
            {!searchTerm && activeStockFilter === 'all' && (
              <Button 
                className="mt-4" 
                onClick={() => navigate('/add-product')}
              >
                הוסף מוצר ראשון
              </Button>
            )}
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b">
                  <th className="text-right p-3 font-medium text-sm">תמונה</th>
                  <th className="text-right p-3 font-medium text-sm">שם המוצר</th>
                  <th className="text-right p-3 font-medium text-sm">ברקוד</th>
                  <th className="text-right p-3 font-medium text-sm">קטגוריה</th>
                  <th className="text-right p-3 font-medium text-sm">כמות</th>
                  <th className="text-right p-3 font-medium text-sm">מחיר</th>
                  <th className="text-right p-3 font-medium text-sm">מיקום</th>
                  <th className="text-right p-3 font-medium text-sm">סטטוס</th>
                  <th className="text-right p-3 font-medium text-sm">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className={`border-b hover:bg-gray-50 transition-colors ${
                      isLowStock(product) ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''
                    }`}
                  >
                    <td className="p-3">
                      <LazyImage
                        src={product.image}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-75 transition-opacity"
                        onClick={() => onViewProductImage(product)}
                        title="לחץ לצפייה בתמונה מוגדלת"
                      />
                    </td>
                    <td className="p-3 font-medium text-sm max-w-[150px] truncate">
                      {isLowStock(product) && <AlertTriangle className="w-4 h-4 text-yellow-600 inline ml-2" />}
                      {product.name}
                    </td>
                    <td className="p-3 text-gray-600 text-sm max-w-[100px] truncate">{product.barcode || '-'}</td>
                    <td className="p-3 text-gray-600 text-sm max-w-[100px] truncate">{getCategoryName(product)}</td>
                    <td className="p-3 font-medium text-sm">{product.quantity}</td>
                    <td className="p-3 text-sm">₪{product.price || '-'}</td>
                    <td className="p-3 text-sm max-w-[100px] truncate">{product.location || '-'}</td>
                    <td className="p-3">{getStatusBadge(product)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onEditProduct(product)}
                          title="ערוך מוצר"
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                          onClick={() => onDeleteProduct(product)}
                          title="מחק מוצר"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

InventoryTable.displayName = 'InventoryTable';
