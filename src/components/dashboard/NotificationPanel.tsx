
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Package, Calendar, AlertTriangle, Settings } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';

export const NotificationPanel: React.FC = () => {
  const { notifications, markAsRead } = useNotifications();
  
  // Get the 5 most recent unread notifications
  const recentNotifications = notifications
    .filter(n => !n.is_read)
    .slice(0, 5);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_stock':
        return <Package className="w-4 h-4 text-red-500" />;
      case 'expired':
        return <Calendar className="w-4 h-4 text-orange-500" />;
      case 'plan_limit':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead.mutate(notificationId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" dir="rtl">
          <Bell className="w-5 h-5" />
          התראות אחרונות
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentNotifications.length === 0 ? (
          <p className="text-gray-500 text-center py-4" dir="rtl">
            אין התראות חדשות
          </p>
        ) : (
          <div className="space-y-3">
            {recentNotifications.map((notification) => (
              <div 
                key={notification.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sm font-medium text-gray-900" dir="rtl">
                    {notification.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-1" dir="rtl">
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="text-xs"
                    >
                      סמן כנקרא
                    </Button>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        חדש
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {format(new Date(notification.created_at), 'dd/MM')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
