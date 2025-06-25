
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { useBIAnalytics } from '@/hooks/useBIAnalytics';

const COLORS = ['#00BFBF', '#FFA940', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

export const SuppliersChart: React.FC = () => {
  const { analytics, isLoading } = useBIAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
            פילוח רכישות לפי ספקים
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

  const hasSupplierData = analytics?.supplierData?.length > 0;

  // Create dummy data for empty state
  const emptyData = [
    { name: 'ספק א\'', value: 0, percentage: 0, fill: COLORS[0] },
    { name: 'ספק ב\'', value: 0, percentage: 0, fill: COLORS[1] },
    { name: 'ספק ג\'', value: 0, percentage: 0, fill: COLORS[2] }
  ];

  const chartData = hasSupplierData 
    ? analytics.supplierData.map((supplier, index) => ({
        name: supplier.supplierName,
        value: supplier.purchaseVolume,
        percentage: supplier.percentage,
        fill: COLORS[index % COLORS.length]
      }))
    : emptyData;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
          פילוח רכישות לפי ספקים
        </CardTitle>
        <div className="text-sm text-gray-600" dir="rtl">
          לפי כמות יחידות שנרכשו
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={hasSupplierData ? ({ name, percentage }) => `${name} (${percentage}%)` : false}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} opacity={hasSupplierData ? 1 : 0.3} />
                ))}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value, name) => [
                  `${Number(value).toLocaleString()} יחידות`,
                  name
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
        
        {!hasSupplierData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg">
            <div className="text-center">
              <div className="text-gray-500 mb-2 font-medium">עדיין אין נתונים זמינים</div>
              <div className="text-sm text-gray-400">
                תרשים זה יציג את פילוח הרכישות לפי ספקים שונים
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-4 space-y-2" dir="rtl">
          {chartData.map((supplier, index) => (
            <div key={supplier.name} className={`flex items-center justify-between text-sm ${hasSupplierData ? '' : 'opacity-30'}`}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: supplier.fill }}
                />
                <span>{supplier.name}</span>
              </div>
              <span className="font-medium">
                {hasSupplierData 
                  ? `${supplier.value.toLocaleString()} יחידות (${supplier.percentage}%)`
                  : 'מחכה לנתונים'
                }
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
