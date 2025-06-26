
import React from 'react';
import { DashboardCard } from './DashboardCard';
import { Package, AlertTriangle, Calendar, DollarSign, CheckCircle } from 'lucide-react';
import { useSummaryStats } from '@/lib/data/getSummaryStats';

export const SummaryGrid: React.FC = () => {
  const { totalProducts, inStockCount, lowStockCount, outOfStockCount, monthlyProfit, isLoading } = useSummaryStats();

  const summaryCards = [
    {
      title: 'סך כל המוצרים',
      value: totalProducts,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'במלאי',
      value: inStockCount,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'מלאי נמוך',
      value: lowStockCount,
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'אזל מהמלאי',
      value: outOfStockCount,
      icon: Calendar,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
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
