
import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  quantity: number;
  location: string | null;
  expiration_date: string | null;
  price: number | null;
  cost: number | null;
  category_name: string | null;
  supplier_name: string | null;
  stock_status: string;
}

interface VirtualizedInventoryTableProps {
  products: Product[];
  searchTerm: string;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onViewProductImage: (product: Product) => void;
  activeStockFilter: 'all' | 'inStock' | 'lowStock' | 'outOfStock';
}

const ROW_HEIGHT = 80;
const HEADER_HEIGHT = 60;

export const VirtualizedInventoryTable: React.FC<VirtualizedInventoryTableProps> = ({
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
    switch (product.stock_status) {
      case 'out_of_stock':
        return <Badge className="bg-red-500 text-white text-xs">אזל</Badge>;
      case 'low_stock':
        return <Badge className="bg-yellow-500 text-white flex items-center gap-1 text-xs">
          <AlertTriangle className="w-3 h-3" />
          נמוך
        </Badge>;
      default:
        return <Badge className="bg-green-500 text-white text-xs">במלאי</Badge>;
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Filter by search term
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.barcode && product.barcode.includes(searchTerm)) ||
        (product.location && product.location.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Filter by stock status
      switch (activeStockFilter) {
        case 'inStock':
          return product.stock_status === 'in_stock';
        case 'lowStock':
          return product.stock_status === 'low_stock';
        case 'outOfStock':
          return product.stock_status === 'out_of_stock';
        case 'all':
        default:
          return true;
      }
    });
  }, [products, searchTerm, activeStockFilter]);

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

  const ProductRow = React.memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const product = filteredProducts[index];
    
    return (
      <div style={style} className="px-2 py-1">
        <Card className={`h-full ${product.stock_status === 'low_stock' ? 'border-l-4 border-l-yellow-500' : ''}`}>
          <CardContent className="p-3 h-full">
            <div className="flex items-center gap-3 h-full">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {product.stock_status === 'low_stock' && (
                      <AlertTriangle className="w-4 h-4 text-yellow-600 inline ml-2" />
                    )}
                    {product.name}
                  </h3>
                  {getStatusBadge(product)}
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <span>כמות: {product.quantity}</span>
                  <span>מחיר: ₪{product.price || '-'}</span>
                  <span>מיקום: {product.location || '-'}</span>
                  <span>קטגוריה: {product.category_name || '-'}</span>
                </div>
              </div>
              
              <div className="flex gap-1 flex-shrink-0">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onEditProduct(product)}
                  className="h-8 w-8 p-0"
                  title="ערוך מוצר"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                  onClick={() => onDeleteProduct(product)}
                  title="מחק מוצר"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  });

  ProductRow.displayName = 'ProductRow';

  if (filteredProducts.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{getFilterTitle()} (0)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {searchTerm || activeStockFilter !== 'all' 
                ? 'לא נמצאו מוצרים מתאימים' 
                : 'עדיין לא נוספו מוצרים'}
            </p>
            {!searchTerm && activeStockFilter === 'all' && (
              <Button onClick={() => navigate('/add-product')}>
                הוסף מוצר ראשון
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{getFilterTitle()} ({filteredProducts.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[600px]">
          <List
            height={600}
            itemCount={filteredProducts.length}
            itemSize={ROW_HEIGHT}
            itemData={filteredProducts}
            overscanCount={5}
          >
            {ProductRow}
          </List>
        </div>
      </CardContent>
    </Card>
  );
};
