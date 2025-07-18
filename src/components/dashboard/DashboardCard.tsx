
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LucideIcon } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  isLoading?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card className="p-4 w-full min-w-0">
        <CardContent className="p-0">
          <div className="flex items-center justify-between">
            <div className="space-y-2 min-w-0 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-4 hover:shadow-md transition-shadow duration-200 w-full min-w-0">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="text-right min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1 truncate" dir="rtl">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 truncate">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${bgColor} flex-shrink-0 ml-3`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
