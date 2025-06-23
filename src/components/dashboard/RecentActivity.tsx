import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { useRealtimeActivity } from '@/hooks/useRealtimeActivity';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

// Action type mappings for Hebrew display
const getActionDisplay = (actionType: string, quantityChanged: number | null) => {
  switch (actionType) {
    case 'add':
      return {
        label: 'הוסף למלאי',
        color: 'bg-green-100 text-green-800'
      };
    case 'remove':
      return {
        label: 'הוצא מהמלאי',
        color: 'bg-red-100 text-red-800'
      };
    case 'adjust':
      return {
        label: 'התאמת מלאי',
        color: 'bg-blue-100 text-blue-800'
      };
    case 'sale':
      return {
        label: 'מכירה',
        color: 'bg-purple-100 text-purple-800'
      };
    case 'return':
      return {
        label: 'החזרה',
        color: 'bg-orange-100 text-orange-800'
      };
    case 'product_added':
      return {
        label: 'מוצר חדש',
        color: 'bg-emerald-100 text-emerald-800'
      };
    case 'product_deleted':
      return {
        label: 'מחיקת מוצר',
        color: 'bg-red-100 text-red-800'
      };
    default:
      return {
        label: actionType,
        color: 'bg-gray-100 text-gray-800'
      };
  }
};

const formatQuantityText = (actionType: string, quantityChanged: number | null) => {
  if (!quantityChanged) return '';
  
  const absQuantity = Math.abs(quantityChanged);
  const sign = quantityChanged > 0 ? '+' : '-';
  
  return ` (${sign}${absQuantity} יח')`;
};

export const RecentActivity: React.FC = () => {
  const { activities, isLoading, error } = useRecentActivity();
  
  // Enable real-time updates
  useRealtimeActivity();

  if (isLoading) {
    return (
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            פעילות אחרונה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            פעילות אחרונה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            שגיאה בטעינת הפעילות האחרונה
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities.length) {
    return (
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            פעילות אחרונה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            אין פעילות אחרונה להצגה
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          פעילות אחרונה
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const actionDisplay = getActionDisplay(activity.action_type, activity.quantity_changed);
            const quantityText = formatQuantityText(activity.action_type, activity.quantity_changed);
            
            // Format timestamp to Hebrew locale
            const formattedDate = format(
              parseISO(activity.timestamp), 
              'dd/MM/yyyy HH:mm', 
              { locale: he }
            );

            return (
              <div key={activity.id} className="flex items-start justify-between border-b border-gray-100 pb-3 last:border-b-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className={actionDisplay.color}>
                      {actionDisplay.label}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {activity.product_name || 'מוצר לא ידוע'}{quantityText}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formattedDate}
                  </p>
                  {activity.notes && (
                    <p className="text-xs text-gray-600 mt-1">
                      {activity.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
