
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Package, AlertTriangle, Calendar, Edit, Trash2 } from 'lucide-react';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useBusiness } from '@/hooks/useBusiness';
import { EditProductDialog } from './EditProductDialog';
import { DeleteProductDialog } from './DeleteProductDialog';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export const OptimizedInventory: React.FC = () => {
  const { business } = useBusiness();
  const { products = [], isLoading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchTerm)) ||
      (product.location && product.location.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm]);

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { label: 'אזל', color: 'destructive' };
    if (quantity < 5) return { label: 'נמוך', color: 'secondary' };
    return { label: 'תקין', color: 'default' };
  };

  const getExpirationStatus = (expirationDate?: string | null) => {
    if (!expirationDate) return null;
    
    const expDate = new Date(expirationDate);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'פג תוקף', color: 'destructive' };
    if (diffDays <= 7) return { label: `${diffDays} ימים`, color: 'secondary' };
    return null;
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleDeleteProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-pulse" />
          <p className="text-gray-600">טוען מוצרים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Controls */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="חפש מוצרים..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button>
          <Plus className="w-4 h-4 ml-2" />
          הוסף מוצר
        </Button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product) => {
          const stockStatus = getStockStatus(product.quantity);
          const expirationStatus = getExpirationStatus(product.expiration_date);
          
          return (
            <Card key={product.id} className="relative group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-semibold truncate">{product.name}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditProduct(product)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteProduct(product)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {product.barcode && (
                  <p className="text-sm text-gray-500 font-mono">{product.barcode}</p>
                )}
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Stock Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">כמות:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{product.quantity}</span>
                    <Badge variant={stockStatus.color as any} className="text-xs">
                      {stockStatus.label}
                    </Badge>
                  </div>
                </div>

                {/* Price */}
                {product.price && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">מחיר:</span>
                    <span className="font-semibold">₪{product.price}</span>
                  </div>
                )}

                {/* Location */}
                {product.location && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">מיקום:</span>
                    <span className="text-sm">{product.location}</span>
                  </div>
                )}

                {/* Expiration */}
                {product.expiration_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">תוקף:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {format(new Date(product.expiration_date), 'dd/MM/yyyy', { locale: he })}
                      </span>
                      {expirationStatus && (
                        <Badge variant={expirationStatus.color as any} className="text-xs">
                          <Calendar className="w-3 h-3 ml-1" />
                          {expirationStatus.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Alerts */}
                {(product.quantity === 0 || expirationStatus?.color === 'destructive') && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 rounded-md">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-700">
                      {product.quantity === 0 ? 'המוצר אזל!' : 'המוצר פג תוקף!'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">לא נמצאו מוצרים</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'נסה לשנות את מונחי החיפוש' : 'התחל על ידי הוספת המוצר הראשון שלך'}
          </p>
          <Button>
            <Plus className="w-4 h-4 ml-2" />
            הוסף מוצר
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      {selectedProduct && (
        <EditProductDialog
          product={selectedProduct}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}

      {/* Delete Dialog */}
      {selectedProduct && (
        <DeleteProductDialog
          product={selectedProduct}
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        />
      )}
    </div>
  );
};
