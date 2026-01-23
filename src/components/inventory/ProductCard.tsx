
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LazyImage } from '@/components/inventory/LazyImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';

interface Product {
  id: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
  image?: string;
  category_name?: string;
  location?: string;
  expiration_date?: string;
}

interface ProductCardProps {
  product: Product;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onEdit,
  onDelete,
}) => {
  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { label: 'אזל', color: 'destructive' };
    if (quantity < 10) return { label: 'מלאי נמוך', color: 'secondary' };
    return { label: 'במלאי', color: 'default' };
  };

  const stockStatus = getStockStatus(product.quantity);

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Product Image */}
          <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
            {product.image ? (
              <LazyImage
                src={product.image}
                alt={product.name}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-gray-900 line-clamp-2" dir="rtl">
                {product.name}
              </h3>
              <Badge variant={stockStatus.color as any}>
                {stockStatus.label}
              </Badge>
            </div>

            <div className="text-sm text-gray-600" dir="rtl">
              <div className="flex justify-between">
                <span>כמות:</span>
                <span className="font-medium">{product.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span>מחיר:</span>
                <span className="font-medium">{formatCurrency(product.price)}</span>
              </div>
              {product.location && (
                <div className="flex justify-between">
                  <span>מיקום:</span>
                  <span>{product.location}</span>
                </div>
              )}
              {product.category_name && (
                <div className="flex justify-between">
                  <span>קטגוריה:</span>
                  <span>{product.category_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(product)}
                className="flex-1"
              >
                <Edit className="w-4 h-4 ml-1" />
                עריכה
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(product.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
