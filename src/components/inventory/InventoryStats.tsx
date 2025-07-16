
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 w-full">
      <button 
        type="button" 
        onClick={() => setActiveStockFilter('all')} 
        className={`focus:outline-none ${
          activeStockFilter === 'all' 
            ? 'ring-2 ring-blue-500 border-blue-500' 
            : 'hover:ring-1 hover:ring-blue-300'
        } rounded-lg transition-shadow w-full`}
      > 
        <Card className="w-full h-full">
          <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-4">
              <Package className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-blue-600" />
              <div>
                <p className="text-sm sm:text-base font-medium text-gray-600">סה״כ מוצרים</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{totalProducts}</p>
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
        } rounded-lg transition-shadow w-full`}
      >
        <Card className="w-full h-full">
          <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-4">
              <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-green-500" />
              <div>
                <p className="text-sm sm:text-base font-medium text-gray-600">במלאי</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{inStock}</p>
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
        } rounded-lg transition-shadow w-full`}
      >
        <Card className="w-full h-full">
          <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-4">
              <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-yellow-500" />
              <div>
                <p className="text-sm sm:text-base font-medium text-gray-600">מלאי נמוך</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600">{lowStock}</p>
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
        } rounded-lg transition-shadow w-full`}
      >
        <Card className="w-full h-full">
          <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-4">
              <XCircle className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-red-500" />
              <div>
                <p className="text-sm sm:text-base font-medium text-gray-600">אזל מהמלאי</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{outOfStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </button>
    </div>
  );
};
