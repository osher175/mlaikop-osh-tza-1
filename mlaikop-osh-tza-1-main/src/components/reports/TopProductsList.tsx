
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Product {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
  profit: number;
}

interface TopProductsListProps {
  topProducts: Product[];
  isLoading: boolean;
  formatCurrency: (amount: number) => string;
}

const TopProductsList: React.FC<TopProductsListProps> = ({ 
  topProducts, 
  isLoading, 
  formatCurrency 
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>המוצרים הנמכרים ביותר</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>המוצרים הנמכרים ביותר</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topProducts.map((product, index) => (
            <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-turquoise text-white rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-600">{product.unitsSold} יחידות נמכרו</p>
                </div>
              </div>
              <div className="text-left">
                <p className="font-bold text-green-600">{formatCurrency(product.revenue)}</p>
                <p className="text-sm text-gray-600">רווח: {formatCurrency(product.profit)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopProductsList;
