
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
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
            הכנסות חודשיות - שנת 2025
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-500 animate-pulse">טוען נתונים...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics?.hasData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
            הכנסות חודשיות - שנת 2025
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <div className="text-gray-500 mb-2 text-lg">אין עדיין תנועות מלאי להצגה</div>
            <div className="text-sm text-gray-400">
              גרף זה יציג הכנסות ברוטו ונטו כאשר יתווספו פעולות מלאי
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasRevenue = analytics.salesData.some(data => data.grossRevenue > 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
          הכנסות חודשיות - שנת 2025
        </CardTitle>
        <div className="text-sm text-gray-600" dir="rtl">
          ברוטו = כולל מע"מ | נטו = לאחר הפחתת 18% מע"מ
        </div>
      </CardHeader>
      <CardContent>
        {!hasRevenue ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <div className="text-gray-500 mb-2">עדיין אין תנועות מלאי רשומות לשנה זו</div>
            <div className="text-sm text-gray-400">
              הגרף יעודכן אוטומטית כאשר יתווספו פעולות הוספת מלאי
            </div>
          </div>
        ) : (
          <div className="w-full">
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <LineChart data={analytics.salesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
