
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Crown, DollarSign, UserPlus } from 'lucide-react';
import { useAdminStats } from '@/lib/data/getAdminStats';
import { Skeleton } from '@/components/ui/skeleton';

export const AdminSummaryGrid: React.FC = () => {
  const { totalUsers, activeSubscriptions, monthlyRevenue, newUsersThisMonth, isLoading } = useAdminStats();

  const summaryCards = [
    {
      title: 'מספר משתמשים כללי',
      value: totalUsers,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'מנויים פעילים',
      value: activeSubscriptions,
      icon: Crown,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'הכנסות החודש',
      value: monthlyRevenue ? `₪${monthlyRevenue.toLocaleString()}` : '₪0',
      icon: DollarSign,
      color: 'text-turquoise',
      bgColor: 'bg-turquoise/10',
    },
    {
      title: 'משתמשים חדשים החודש',
      value: newUsersThisMonth,
      icon: UserPlus,
      color: 'text-mango',
      bgColor: 'bg-mango/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-4">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-12 w-12 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {summaryCards.map((card, index) => (
        <Card key={index} className="p-4 hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-600 mb-1 font-rubik" dir="rtl">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-gray-900 font-rubik">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
