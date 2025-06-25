
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

  const hasProducts = analytics.topProducts.length > 0;

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
        <div className="space-y-4 relative h-64">
          {/* Empty state structure - shows ranking positions */}
          {!hasProducts && (
            <>
              {[1, 2, 3, 4, 5].map((rank) => {
                const IconComponent = rankIcons[rank - 1];
                const iconColor = rankColors[rank - 1];
                
                return (
                  <div key={rank} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-30">
                    <div className="flex items-center gap-3" dir="rtl">
                      <IconComponent className={`w-6 h-6 ${iconColor}`} />
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-400">מקום {rank}</span>
                        <span className="text-sm text-gray-300">מחכה לנתונים</span>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-gray-300">
                      #{rank}
                    </div>
                  </div>
                );
              })}
              
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-gray-500 mb-2 font-medium">עדיין אין נתונים זמינים</div>
                  <div className="text-sm text-gray-400">
                    כאן יוצגו טופ 5 המוצרים הנמכרים ביותר
                  </div>
                </div>
              </div>
            </>
          )}
          
          {/* Real data */}
          {hasProducts && analytics.topProducts.map((product, index) => {
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
        </div>
      </CardContent>
    </Card>
  );
};
