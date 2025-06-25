
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { useBIAnalytics } from '@/hooks/useBIAnalytics';

const chartConfig = {
  grossRevenue: {
    label: "הכנסות ברוטו",
    color: "#00BFBF",
  },
  netRevenue: {
    label: "הכנסות נטו",
    color: "#FFA940",
  },
};

export const RevenueChart: React.FC = () => {
  const { analytics, isLoading } = useBIAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
            הכנסות חודשיות - שנת 2025
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

  const hasRevenue = analytics.salesData.some(data => data.grossRevenue > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
          הכנסות חודשיות - שנת 2025
        </CardTitle>
        <div className="text-sm text-gray-600" dir="rtl">
          ברוטו = כולל מע"מ | נטו = לאחר הפחתת 18% מע"מ
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 relative">
          <LineChart data={analytics.salesData}>
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `₪${value.toLocaleString()}`}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              formatter={(value, name) => [
                `₪${Number(value).toLocaleString()}`, 
                name === 'grossRevenue' ? 'ברוטו (כולל מע"מ)' : 'נטו (ללא מע"מ)'
              ]}
            />
            <Legend />
            <Line 
              dataKey="grossRevenue" 
              stroke="#00BFBF" 
              strokeWidth={3}
              dot={{ fill: '#00BFBF', strokeWidth: 2, r: 4 }}
              name="הכנסות ברוטו"
            />
            <Line 
              dataKey="netRevenue" 
              stroke="#FFA940" 
              strokeWidth={3}
              dot={{ fill: '#FFA940', strokeWidth: 2, r: 4 }}
              name="הכנסות נטו"
            />
          </LineChart>
          
          {!hasRevenue && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="text-center">
                <div className="text-gray-500 mb-2 font-medium">עדיין אין נתונים זמינים</div>
                <div className="text-sm text-gray-400">
                  הנתונים יתעדכנו אוטומטית עם תחילת הפעילות
                </div>
              </div>
            </div>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
