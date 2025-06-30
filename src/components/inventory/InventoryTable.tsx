
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
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
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  products,
  searchTerm,
  onEditProduct,
  onDeleteProduct,
  onViewProductImage,
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const getStatusBadge = (product: Product) => {
    const quantity = product.quantity;
    const threshold = product.product_thresholds?.low_stock_threshold || 5;
    
    if (quantity === 0) {
      return <Badge className="bg-red-500 text-white">אזל מהמלאי</Badge>;
    } else if (quantity <= threshold && quantity > 0) {
      return <Badge className="bg-yellow-500 text-white flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        מלאי נמוך
      </Badge>;
    } else {
      return <Badge className="bg-green-500 text-white">במלאי</Badge>;
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

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm)) ||
    (product.location && product.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Mobile card view
  if (isMobile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>רשימת מוצרים ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                {searchTerm ? 'לא נמצאו מוצרים מתאימים' : 'עדיין לא נוספו מוצרים'}
              </p>
              {!searchTerm && (
                <Button 
                  className="w-full h-12" 
                  onClick={() => navigate('/add-product')}
                >
                  הוסף מוצר ראשון
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <Card 
                  key={product.id} 
                  className={`${isLowStock(product) ? 'border-l-4 border-l-yellow-500 shadow-md' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-75 transition-opacity"
                          onClick={() => onViewProductImage(product)}
                          title="לחץ לצפייה בתמונה מוגדלת"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {product.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          קטגוריה: {getCategoryName(product)}
                        </p>
                        {product.barcode && (
                          <p className="text-xs text-gray-500">
                            ברקוד: {product.barcode}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {getStatusBadge(product)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-gray-600">כמות: </span>
                        <span className="font-medium">{product.quantity}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">מחיר: </span>
                        <span className="font-medium">₪{product.price || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">מיקום: </span>
                        <span className="font-medium">{product.location || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">עלות: </span>
                        <span className="font-medium">₪{product.cost || '-'}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onEditProduct(product)}
                        className="flex-1 h-10"
                        title="ערוך מוצר"
                      >
                        <Edit className="w-4 h-4 ml-1" />
                        ערוך
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700 h-10 px-3"
                        onClick={() => onDeleteProduct(product)}
                        title="מחק מוצר"
                      >
                        <Trash2 className="w-4 h-4" />
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

  // Desktop table view
  return (
    <Card>
      <CardHeader>
        <CardTitle>רשימת מוצרים ({filteredProducts.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'לא נמצאו מוצרים מתאימים' : 'עדיין לא נוספו מוצרים'}
            </p>
            {!searchTerm && (
              <Button 
                className="mt-4" 
                onClick={() => navigate('/add-product')}
              >
                הוסף מוצר ראשון
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right p-4 font-medium">תמונה</th>
                  <th className="text-right p-4 font-medium">שם המוצר</th>
                  <th className="text-right p-4 font-medium">ברקוד</th>
                  <th className="text-right p-4 font-medium">קטגוריה</th>
                  <th className="text-right p-4 font-medium">כמות</th>
                  <th className="text-right p-4 font-medium">מחיר</th>
                  <th className="text-right p-4 font-medium">מיקום</th>
                  <th className="text-right p-4 font-medium">סטטוס</th>
                  <th className="text-right p-4 font-medium">פעולות</th>
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
                    <td className="p-4">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-75 transition-opacity"
                          onClick={() => onViewProductImage(product)}
                          title="לחץ לצפייה בתמונה מוגדלת"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-medium">
                      {isLowStock(product) && <AlertTriangle className="w-4 h-4 text-yellow-600 inline ml-2" />}
                      {product.name}
                    </td>
                    <td className="p-4 text-gray-600">{product.barcode || '-'}</td>
                    <td className="p-4 text-gray-600">{getCategoryName(product)}</td>
                    <td className="p-4 font-medium">{product.quantity}</td>
                    <td className="p-4">₪{product.price || '-'}</td>
                    <td className="p-4">{product.location || '-'}</td>
                    <td className="p-4">{getStatusBadge(product)}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onEditProduct(product)}
                          title="ערוך מוצר"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                          onClick={() => onDeleteProduct(product)}
                          title="מחק מוצר"
                        >
                          <Trash2 className="w-4 h-4" />
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
};
