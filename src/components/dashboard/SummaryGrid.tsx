
import React from 'react';
import { DashboardCard } from './DashboardCard';
import { Package, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { useSummaryStats } from '@/lib/data/getSummaryStats';

export const SummaryGrid: React.FC = () => {
  const { totalProducts, lowStockCount, expiredCount, monthlyProfit, isLoading } = useSummaryStats();

  const summaryCards = [
    {
      title: 'סך כל המוצרים במלאי',
      value: totalProducts,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'מוצרים מתחת לסף',
      value: lowStockCount,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'מוצרים שפג תוקפם',
      value: expiredCount,
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'רווח חודשי אחרון',
      value: monthlyProfit ? `₪${monthlyProfit.toLocaleString()}` : '₪0',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {summaryCards.map((card, index) => (
        <DashboardCard
          key={index}
          title={card.title}
          value={card.value}
          icon={card.icon}
          color={card.color}
          bgColor={card.bgColor}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
};
