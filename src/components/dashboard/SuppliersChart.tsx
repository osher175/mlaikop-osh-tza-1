
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

  const hasData = analytics.supplierData.length > 0;
  
  // Create chart data - use real data if available, otherwise show placeholder
  const chartData = hasData 
    ? analytics.supplierData.map((supplier, index) => ({
        name: supplier.supplierName,
        value: supplier.purchaseVolume,
        percentage: supplier.percentage,
        fill: COLORS[index % COLORS.length]
      }))
    : [
        { name: 'אין נתונים', value: 1, percentage: 100, fill: '#E5E7EB' }
      ];

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
        <ChartContainer config={{}} className="h-64">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={hasData ? ({ name, percentage }) => `${name} (${percentage}%)` : false}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip 
              content={<ChartTooltipContent />}
              formatter={(value, name) => [
                hasData ? `${Number(value).toLocaleString()} יחידות` : 'אין נתונים',
                name
              ]}
            />
          </PieChart>
        </ChartContainer>
        
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg">
            <div className="text-center">
              <div className="text-gray-500 mb-2">עדיין אין נתוני רכישות</div>
              <div className="text-sm text-gray-400">
                תרשים זה יציג את פילוח הרכישות לפי ספקים שונים
              </div>
            </div>
          </div>
        )}
        
        {hasData && (
          <div className="mt-4 space-y-2" dir="rtl">
            {chartData.map((supplier, index) => (
              <div key={supplier.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: supplier.fill }}
                  />
                  <span>{supplier.name}</span>
                </div>
                <span className="font-medium">
                  {supplier.value.toLocaleString()} יחידות ({supplier.percentage}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
