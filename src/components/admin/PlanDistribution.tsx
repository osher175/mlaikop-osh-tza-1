
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

const planData = [
  { name: 'Freemium', value: 320, color: '#E5E7EB' },
  { name: 'Premium 1', value: 125, color: '#FFA940' },
  { name: 'Premium 2', value: 89, color: '#00BFBF' },
  { name: 'Premium 3', value: 34, color: '#10B981' },
];

const chartConfig = {
  users: {
    label: "משתמשים",
  },
};

export const PlanDistribution: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 font-rubik" dir="rtl">
          פילוח תוכניות מנוי
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64">
          <PieChart>
            <Pie
              data={planData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {planData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <ChartTooltip 
              content={<ChartTooltipContent />}
              formatter={(value, name) => [`${value} משתמשים`, name]}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value) => <span style={{ color: '#374151', fontSize: '12px' }}>{value}</span>}
            />
          </PieChart>
        </ChartContainer>
        
        {/* Summary below chart */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-rubik">
          {planData.map((plan, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-gray-600">{plan.name}</span>
              <span className="font-semibold">{plan.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
