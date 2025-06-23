
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { useRealtimeActivity } from '@/hooks/useRealtimeActivity';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

// Status color mappings for badges
const getStatusColorClass = (statusColor: string) => {
  switch (statusColor) {
    case 'success':
      return 'bg-green-100 text-green-800';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800';
    case 'error':
      return 'bg-red-100 text-red-800';
    case 'info':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Priority level mappings
const getPriorityIcon = (priorityLevel: string, isCritical: boolean) => {
  if (isCritical) return '🚨';
  switch (priorityLevel) {
    case 'high':
      return '⚠️';
    case 'medium':
      return 'ℹ️';
    case 'low':
      return '📝';
    default:
      return 'ℹ️';
  }
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
            const statusColorClass = getStatusColorClass(activity.status_color);
            const priorityIcon = getPriorityIcon(activity.priority_level, activity.is_critical);
            
            // Format timestamp to Hebrew locale
            const formattedDate = format(
              parseISO(activity.timestamp), 
              'dd/MM/yyyy HH:mm', 
              { locale: he }
            );

            return (
              <div 
                key={activity.id} 
                className={`flex items-start justify-between border-b border-gray-100 pb-3 last:border-b-0 ${
                  activity.is_critical ? 'bg-red-50 rounded-lg p-3' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{priorityIcon}</span>
                    <Badge variant="secondary" className={statusColorClass}>
                      {activity.priority_level === 'high' ? 'חשוב' : 
                       activity.priority_level === 'medium' ? 'בינוני' : 'רגיל'}
                    </Badge>
                    {activity.is_system_generated && (
                      <Badge variant="outline" className="text-xs">
                        מערכת
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {activity.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formattedDate}
                  </p>
                  {activity.quantity_changed && (
                    <p className="text-xs text-gray-600 mt-1">
                      שינוי כמות: {activity.quantity_changed > 0 ? '+' : ''}{activity.quantity_changed}
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
