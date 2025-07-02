
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useRevenueHistory } from '@/lib/data/getRevenueHistory';

const chartConfig = {
  revenue: {
    label: "הכנסות",
    color: "#00BFBF",
  },
};

export const RevenueChart: React.FC = () => {
  const { revenueData, isLoading } = useRevenueHistory();

  // Fallback dummy data if no real data available
  const dummyData = [
    { month: 'ינואר', revenue: 45000 },
    { month: 'פברואר', revenue: 52000 },
    { month: 'מרץ', revenue: 48000 },
    { month: 'אפריל', revenue: 61000 },
    { month: 'מאי', revenue: 55000 },
    { month: 'יוני', revenue: 67000 },
  ];

  const chartData = revenueData && revenueData.length > 0 ? revenueData : dummyData;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 font-rubik" dir="rtl">
          גרף הכנסות חודשי
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-500 font-rubik">טוען נתונים...</div>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-64">
            <BarChart data={chartData}>
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
                formatter={(value) => [`₪${value.toLocaleString()}`, 'הכנסות']}
              />
              <Bar 
                dataKey="revenue" 
                fill="#00BFBF" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
