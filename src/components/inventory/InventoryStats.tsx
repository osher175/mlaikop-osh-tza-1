
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Package, AlertCircle } from 'lucide-react';

interface InventoryStatsProps {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({
  totalProducts,
  inStock,
  lowStock,
  outOfStock,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-primary" />
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">סה״כ מוצרים</p>
              <p className="text-2xl font-bold">{totalProducts}</p>
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
  );
};
