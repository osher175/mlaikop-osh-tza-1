
import React from 'react';
import { Package, TrendingUp, AlertTriangle, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const stats = [
  {
    title: 'סה"כ מוצרים',
    value: '1,247',
    change: '+12%',
    changeType: 'positive' as const,
    icon: Package,
    color: 'text-turquoise'
  },
  {
    title: 'מכירות היום',
    value: '₪3,892',
    change: '+8%',
    changeType: 'positive' as const,
    icon: TrendingUp,
    color: 'text-mango'
  },
  {
    title: 'מוצרים נגמרים',
    value: '23',
    change: '+3',
    changeType: 'negative' as const,
    icon: AlertTriangle,
    color: 'text-red-500'
  },
  {
    title: 'הזמנות פעילות',
    value: '156',
    change: '-5%',
    changeType: 'negative' as const,
    icon: ShoppingCart,
    color: 'text-gray-600'
  }
];

export const StatsCards: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <Card key={stat.title} className="card-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <p className={`text-xs ${
              stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
            }`}>
              {stat.change} מהחודש הקודם
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
