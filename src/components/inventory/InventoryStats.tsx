
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Package, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface InventoryStatsProps {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  activeStockFilter: 'all' | 'inStock' | 'lowStock' | 'outOfStock';
  setActiveStockFilter: (filter: 'all' | 'inStock' | 'lowStock' | 'outOfStock') => void;
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({
  totalProducts,
  inStock,
  lowStock,
  outOfStock,
  activeStockFilter,
  setActiveStockFilter,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <button 
        type="button" 
        onClick={() => setActiveStockFilter('all')} 
        className={`focus:outline-none ${
          activeStockFilter === 'all' 
            ? 'ring-2 ring-blue-500 border-blue-500' 
            : 'hover:ring-1 hover:ring-blue-300'
        } rounded-lg transition-shadow`}
      > 
        <Card className="w-full h-full">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600">סה״כ מוצרים</p>
                <p className="text-2xl font-bold text-blue-600">{totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </button>
      
      <button 
        type="button" 
        onClick={() => setActiveStockFilter('inStock')} 
        className={`focus:outline-none ${
          activeStockFilter === 'inStock' 
            ? 'ring-2 ring-green-500 border-green-500' 
            : 'hover:ring-1 hover:ring-green-300'
        } rounded-lg transition-shadow`}
      >
        <Card className="w-full h-full">
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600">במלאי</p>
                <p className="text-2xl font-bold text-green-600">{inStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </button>

      <button 
        type="button" 
        onClick={() => setActiveStockFilter('lowStock')} 
        className={`focus:outline-none ${
          activeStockFilter === 'lowStock' 
            ? 'ring-2 ring-yellow-500 border-yellow-500' 
            : 'hover:ring-1 hover:ring-yellow-300'
        } rounded-lg transition-shadow`}
      >
        <Card className="w-full h-full">
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
      </button>

      <button 
        type="button" 
        onClick={() => setActiveStockFilter('outOfStock')} 
        className={`focus:outline-none ${
          activeStockFilter === 'outOfStock' 
            ? 'ring-2 ring-red-500 border-red-500' 
            : 'hover:ring-1 hover:ring-red-300'
        } rounded-lg transition-shadow`}
      >
        <Card className="w-full h-full">
          <CardContent className="p-6">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-500" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600">אזל מהמלאי</p>
                <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </button>
    </div>
  );
};
