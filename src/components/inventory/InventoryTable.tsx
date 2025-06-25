
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
  product_categories?: { name: string } | null;
  categories?: { name: string } | null;
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

  const getStatusBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge className="bg-red-500">אזל מהמלאי</Badge>;
    } else if (quantity <= 5) {
      return <Badge className="bg-yellow-500">מלאי נמוך</Badge>;
    } else {
      return <Badge className="bg-green-500">במלאי</Badge>;
    }
  };

  const getCategoryName = (product: Product) => {
    return product.product_categories?.name || product.categories?.name || '-';
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm)) ||
    (product.location && product.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>רשימת מוצרים</CardTitle>
      </CardHeader>
      <CardContent>
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
                <tr className="border-b">
                  <th className="text-right p-4">תמונה</th>
                  <th className="text-right p-4">שם המוצר</th>
                  <th className="text-right p-4">ברקוד</th>
                  <th className="text-right p-4">קטגוריה</th>
                  <th className="text-right p-4">כמות</th>
                  <th className="text-right p-4">מחיר</th>
                  <th className="text-right p-4">מיקום</th>
                  <th className="text-right p-4">סטטוס</th>
                  <th className="text-right p-4">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-gray-50">
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
                    <td className="p-4 font-medium">{product.name}</td>
                    <td className="p-4 text-gray-600">{product.barcode || '-'}</td>
                    <td className="p-4 text-gray-600">{getCategoryName(product)}</td>
                    <td className="p-4">{product.quantity}</td>
                    <td className="p-4">₪{product.price || '-'}</td>
                    <td className="p-4">{product.location || '-'}</td>
                    <td className="p-4">{getStatusBadge(product.quantity)}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onEditProduct(product)}
                          title="ערוך מוצר"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-600 hover:text-red-700"
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
