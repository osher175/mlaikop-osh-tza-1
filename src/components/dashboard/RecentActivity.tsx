
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

const getActivityBadgeStyle = (actionType: string, isCritical: boolean = false) => {
  if (isCritical) {
    return 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100';
  }
  
  switch (actionType) {
    case 'product_added':
    case 'inventory_added':
      return 'bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100';
    case 'out_of_stock':
    case 'low_stock_warning':
      return 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100';
    case 'product_updated':
      return 'bg-accent-50 text-accent-700 border border-accent-200 hover:bg-accent-100';
    case 'inventory_reduced':
      return 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100';
    default:
      return 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100';
  }
};

const getIconBadgeStyle = (actionType: string, isCritical: boolean = false) => {
  if (isCritical) {
    return 'bg-red-100 text-red-600';
  }
  
  switch (actionType) {
    case 'product_added':
    case 'inventory_added':
      return 'bg-primary-100 text-primary-600';
    case 'out_of_stock':
    case 'low_stock_warning':
      return 'bg-red-100 text-red-600';
    case 'product_updated':
      return 'bg-accent-100 text-accent-600';
    case 'inventory_reduced':
      return 'bg-orange-100 text-orange-600';
    default:
      return 'bg-gray-100 text-gray-600';
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
      <Card className="rounded-lg shadow-sm border border-gray-200 bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 font-rubik" dir="rtl">
            פעילות אחרונה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 text-center py-4 font-rubik text-sm" dir="rtl">
            שגיאה בטעינת הפעילות האחרונה
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg shadow-sm border border-gray-200 bg-white">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900 font-rubik flex items-center gap-2" dir="rtl">
          פעילות אחרונה
          {activities.length > 0 && (
            <Badge className="bg-primary-50 text-primary-700 border border-primary-200 text-xs font-medium px-2 py-0.5 rounded-full">
              {activities.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3" dir="rtl">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 p-3">
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
              <p className="font-rubik text-sm">אין פעילות אחרונה</p>
              <p className="text-xs font-rubik text-gray-400 mt-1">כאשר תתבצע פעילות במערכת, היא תופיע כאן</p>
            </div>
          ) : (
            activities.map((activity) => {
              const Icon = getActivityIcon(activity.action_type);
              const userName = activity.profiles 
                ? `${activity.profiles.first_name || ''} ${activity.profiles.last_name || ''}`.trim()
                : 'משתמש לא ידוע';
              
              return (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  <div className={`p-2.5 rounded-lg flex-shrink-0 ${getIconBadgeStyle(activity.action_type, activity.is_critical)}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge className={`text-xs font-medium px-2.5 py-1 rounded-lg ${getActivityBadgeStyle(activity.action_type, activity.is_critical)}`}>
                        {activity.title}
                      </Badge>
                      {activity.is_critical && (
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    {activity.description && (
                      <p className="text-sm text-gray-600 mb-2 font-rubik leading-relaxed">
                        {activity.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-rubik">
                      <span className="font-medium">{userName}</span>
                      <span className="text-gray-300">•</span>
                      <span>{formatTimeAgo(activity.timestamp)}</span>
                      {activity.quantity_changed && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${
                            activity.quantity_changed > 0 
                              ? 'bg-green-50 text-green-600' 
                              : 'bg-red-50 text-red-600'
                          }`}>
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
