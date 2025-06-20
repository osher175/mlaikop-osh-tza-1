
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Trash2, Package, AlertCircle, Loader2 } from 'lucide-react';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { CreateBusinessDialog } from '@/components/CreateBusinessDialog';
import { EditProductDialog } from '@/components/inventory/EditProductDialog';
import { DeleteProductDialog } from '@/components/inventory/DeleteProductDialog';
import { ExpirationAlertsPanel } from '@/components/inventory/ExpirationAlertsPanel';
import { useProducts } from '@/hooks/useProducts';
import { useBusiness } from '@/hooks/useBusiness';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

export const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateBusiness, setShowCreateBusiness] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const navigate = useNavigate();
  
  const { products, isLoading: productsLoading, refetch } = useProducts();
  const { business, isLoading: businessLoading } = useBusiness();

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm)) ||
    (product.location && product.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge className="bg-red-500">אזל מהמלאי</Badge>;
    } else if (quantity <= 5) {
      return <Badge className="bg-yellow-500">מלאי נמוך</Badge>;
    } else {
      return <Badge className="bg-green-500">במלאי</Badge>;
    }
  };

  const getStatusCounts = () => {
    const inStock = products.filter(p => p.quantity > 5).length;
    const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= 5).length;
    const outOfStock = products.filter(p => p.quantity === 0).length;
    
    return { inStock, lowStock, outOfStock };
  };

  const handleProductUpdated = () => {
    refetch();
  };

  const handleProductDeleted = () => {
    refetch();
  };

  const { inStock, lowStock, outOfStock } = getStatusCounts();

  if (businessLoading || productsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!business) {
    return (
      <MainLayout>
        <div className="text-center py-12" dir="rtl">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            עדיין לא נוצר עסק
          </h2>
          <p className="text-gray-600 mb-6">
            כדי להתחיל לנהל מלאי, תחילה צריך ליצור עסק
          </p>
          <Button onClick={() => setShowCreateBusiness(true)}>
            צור עסק חדש
          </Button>
          <CreateBusinessDialog 
            open={showCreateBusiness} 
            onClose={() => setShowCreateBusiness(false)} 
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ניהול מלאי</h1>
            <p className="text-gray-600">נהל את המוצרים והמלאי של {business.name}</p>
          </div>
          <Button 
            className="bg-primary hover:bg-primary-600"
            onClick={() => navigate('/add-product')}
          >
            <Plus className="w-4 h-4 ml-2" />
            הוסף מוצר חדש
          </Button>
        </div>

        {/* Expiration Alerts Panel */}
        <ExpirationAlertsPanel />

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="חפש מוצרים..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <ProtectedFeature requiredRole="pro_starter_user">
                <Button variant="outline">סנן לפי קטגוריה</Button>
                <Button variant="outline">סנן לפי מיקום</Button>
              </ProtectedFeature>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-primary" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">סה״כ מוצרים</p>
                  <p className="text-2xl font-bold">{products.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-green-500" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">במלאי</p>
                  <p className="text-2xl font-bold text-green-600">{inStock}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-yellow-500" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">מלאי נמוך</p>
                  <p className="text-2xl font-bold text-yellow-600">{lowStock}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">אזל מהמלאי</p>
                  <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products Table */}
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
                      <th className="text-right p-4">שם המוצר</th>
                      <th className="text-right p-4">ברקוד</th>
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
                        <td className="p-4 font-medium">{product.name}</td>
                        <td className="p-4 text-gray-600">{product.barcode || '-'}</td>
                        <td className="p-4">{product.quantity}</td>
                        <td className="p-4">₪{product.price || '-'}</td>
                        <td className="p-4">{product.location || '-'}</td>
                        <td className="p-4">{getStatusBadge(product.quantity)}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setEditingProduct(product)}
                              title="ערוך מוצר"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setDeletingProduct(product)}
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

        {/* Edit Product Dialog */}
        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          onProductUpdated={handleProductUpdated}
        />

        {/* Delete Product Dialog */}
        <DeleteProductDialog
          product={deletingProduct}
          open={!!deletingProduct}
          onOpenChange={(open) => !open && setDeletingProduct(null)}
          onProductDeleted={handleProductDeleted}
        />
      </div>
    </MainLayout>
  );
};
