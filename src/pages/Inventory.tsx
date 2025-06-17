
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Trash2, Package, AlertCircle } from 'lucide-react';
import { ProtectedFeature } from '@/components/ProtectedFeature';

interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  quantity: number;
  price: number;
  cost: number;
  location: string;
  expirationDate?: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

const mockProducts: Product[] = [
  {
    id: '1',
    name: 'מחשב נייד Dell',
    barcode: '123456789',
    category: 'מחשבים',
    quantity: 15,
    price: 3500,
    cost: 2800,
    location: 'מדף A1',
    status: 'in_stock'
  },
  {
    id: '2',
    name: 'עכבר אלחוטי',
    barcode: '987654321',
    category: 'אביזרים',
    quantity: 5,
    price: 89,
    cost: 45,
    location: 'מדף B2',
    status: 'low_stock'
  },
  {
    id: '3',
    name: 'מקלדת מכנית',
    barcode: '456789123',
    category: 'אביזרים',
    quantity: 0,
    price: 299,
    cost: 180,
    location: 'מדף B3',
    status: 'out_of_stock'
  }
];

export const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState(mockProducts);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge className="bg-green-500">במלאי</Badge>;
      case 'low_stock':
        return <Badge className="bg-yellow-500">מלאי נמוך</Badge>;
      case 'out_of_stock':
        return <Badge className="bg-red-500">אזל מהמלאי</Badge>;
      default:
        return <Badge>לא ידוע</Badge>;
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    const filtered = mockProducts.filter(product =>
      product.name.includes(value) ||
      product.barcode.includes(value) ||
      product.category.includes(value)
    );
    setFilteredProducts(filtered);
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ניהול מלאי</h1>
            <p className="text-gray-600">נהל את המוצרים והמלאי שלך</p>
          </div>
          <Button className="bg-primary hover:bg-primary-600">
            <Plus className="w-4 h-4 ml-2" />
            הוסף מוצר חדש
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="חפש מוצרים..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
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
                  <p className="text-2xl font-bold">{mockProducts.length}</p>
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
                  <p className="text-2xl font-bold text-green-600">
                    {mockProducts.filter(p => p.status === 'in_stock').length}
                  </p>
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
                  <p className="text-2xl font-bold text-yellow-600">
                    {mockProducts.filter(p => p.status === 'low_stock').length}
                  </p>
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
                  <p className="text-2xl font-bold text-red-600">
                    {mockProducts.filter(p => p.status === 'out_of_stock').length}
                  </p>
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
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
                      <td className="p-4 font-medium">{product.name}</td>
                      <td className="p-4 text-gray-600">{product.barcode}</td>
                      <td className="p-4">{product.category}</td>
                      <td className="p-4">{product.quantity}</td>
                      <td className="p-4">₪{product.price}</td>
                      <td className="p-4">{product.location}</td>
                      <td className="p-4">{getStatusBadge(product.status)}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};
