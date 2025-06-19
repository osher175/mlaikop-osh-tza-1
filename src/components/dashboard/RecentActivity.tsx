
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { AlertTriangle, Package, ShoppingCart, UserPlus, Settings } from 'lucide-react';

const getActivityIcon = (actionType: string) => {
  switch (actionType) {
    case 'product_added':
    case 'product_updated':
      return Package;
    case 'inventory_added':
    case 'inventory_reduced':
      return ShoppingCart;
    case 'out_of_stock':
    case 'low_stock_warning':
      return AlertTriangle;
    case 'user_added':
    case 'user_login':
      return UserPlus;
    default:
      return Settings;
  }
};

const getActivityColor = (statusColor: string, isCritical: boolean = false) => {
  if (isCritical) return 'bg-red-100 text-red-800 border-red-200';
  
  switch (statusColor) {
    case 'success': return 'bg-green-100 text-green-800 border-green-200';
    case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'error': return 'bg-red-100 text-red-800 border-red-200';
    case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatTimeAgo = (timestamp: string) => {
  try {
    return formatDistanceToNow(new Date(timestamp), { 
      addSuffix: true, 
      locale: he 
    }).replace('בעוד', 'לפני');
  } catch (error) {
    return 'זמן לא ידוע';
  }
};

export const RecentActivity: React.FC = () => {
  const { activities, isLoading, error } = useRecentActivity(8);

  if (error) {
    return (
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            פעילות אחרונה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 text-center py-4">
            שגיאה בטעינת הפעילות האחרונה
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          פעילות אחרונה
          {activities.length > 0 && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
              {activities.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>אין פעילות אחרונה</p>
              <p className="text-sm">כאשר תתבצע פעילות במערכת, היא תופיע כאן</p>
            </div>
          ) : (
            activities.map((activity) => {
              const Icon = getActivityIcon(activity.action_type);
              const userName = activity.profiles 
                ? `${activity.profiles.first_name || ''} ${activity.profiles.last_name || ''}`.trim()
                : 'משתמש לא ידוע';
              
              return (
                <div key={activity.id} className="flex items-start gap-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    activity.is_critical ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      activity.is_critical ? 'text-red-600' : 'text-gray-600'
                    }`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getActivityColor(activity.status_color, activity.is_critical)}`}
                      >
                        {activity.title}
                      </Badge>
                      {activity.is_critical && (
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    {activity.description && (
                      <p className="text-sm text-gray-600 mb-1">
                        {activity.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{userName}</span>
                      <span>•</span>
                      <span>{formatTimeAgo(activity.timestamp)}</span>
                      {activity.quantity_changed && (
                        <>
                          <span>•</span>
                          <span className={activity.quantity_changed > 0 ? 'text-green-600' : 'text-red-600'}>
                            {activity.quantity_changed > 0 ? '+' : ''}{activity.quantity_changed}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
