
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useBIAnalytics } from '@/hooks/useBIAnalytics';

const COLORS = ['#00BFBF', '#FFA940', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

export const SuppliersChart: React.FC = () => {
  const { analytics, isLoading } = useBIAnalytics();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
          פילוח רכישות לפי ספקים
        </CardTitle>
        <div className="text-sm text-gray-600" dir="rtl">
          לפי כמות יחידות שהתווספו למלאי
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-500 animate-pulse">טוען נתונים...</div>
          </div>
        ) : !analytics?.hasData || analytics.supplierData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <div className="text-gray-500 mb-2 text-lg">עדיין אין נתוני רכישות</div>
            <div className="text-sm text-gray-400">
              תרשים זה יציג את פילוח פעולות הוספת המלאי לפי ספקים שונים
            </div>
          </div>
        ) : (
          <>
            <div className="w-full">
              <ChartContainer config={{}} className="h-64 w-full">
                <PieChart>
                  <Pie
                    data={analytics.supplierData.map((supplier, index) => ({
                      name: supplier.supplierName,
                      value: supplier.purchaseVolume,
                      percentage: supplier.percentage,
                      fill: COLORS[index % COLORS.length]
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                    labelLine={false}
                  >
                    {analytics.supplierData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
              </ChartContainer>
            </div>
            
            <div className="mt-4 space-y-2" dir="rtl">
              {analytics.supplierData.map((supplier, index) => (
                <div key={supplier.supplierName} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span>{supplier.supplierName}</span>
                  </div>
                  <span className="font-medium">
                    {supplier.purchaseVolume.toLocaleString()} יחידות ({supplier.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
