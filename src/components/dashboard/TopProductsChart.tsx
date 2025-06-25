
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award, Star, Circle } from 'lucide-react';
import { useBIAnalytics } from '@/hooks/useBIAnalytics';

const rankIcons = [Trophy, Medal, Award, Star, Circle];
const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600', 'text-blue-500', 'text-green-500'];

export const TopProductsChart: React.FC = () => {
  const { analytics, isLoading } = useBIAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
            מוצרי המכירה המובילים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-500">טוען נתונים...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics?.hasData || analytics.topProducts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
            מוצרי המכירה המובילים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <div className="text-gray-500 mb-2">עדיין אין נתוני מכירות</div>
            <div className="text-sm text-gray-400">
              כאן יוצגו טופ 5 המוצרים הנמכרים ביותר
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
          מוצרי המכירה המובילים
        </CardTitle>
        <div className="text-sm text-gray-600" dir="rtl">
          דירוג לפי כמות יחידות שנמכרו
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {analytics.topProducts.map((product, index) => {
            const IconComponent = rankIcons[index];
            const iconColor = rankColors[index];
            
            return (
              <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3" dir="rtl">
                  <IconComponent className={`w-6 h-6 ${iconColor}`} />
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{product.productName}</span>
                    <span className="text-sm text-gray-600">
                      {product.quantity} יחידות • ₪{product.revenue.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-xl font-bold text-gray-700">
                  #{index + 1}
                </div>
              </div>
            );
          })}
          
          {analytics.topProducts.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              עדיין אין מוצרים נמכרים לתצוגה
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
