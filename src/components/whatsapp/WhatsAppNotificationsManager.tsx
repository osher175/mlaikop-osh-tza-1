
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useWhatsAppNotifications } from '@/hooks/useWhatsAppNotifications';
import { MessageCircle, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export const WhatsAppNotificationsManager: React.FC = () => {
  const { notifications, isLoading, updateNotificationStatus } = useWhatsAppNotifications();

  const handleMarkAsSent = async (id: string) => {
    try {
      await updateNotificationStatus.mutateAsync({ id, was_sent: true });
    } catch (error) {
      console.error('Error marking notification as sent:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            הודעות WhatsApp לספקים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">טוען הודעות...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          הודעות WhatsApp לספקים
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            אין הודעות WhatsApp ממתינות
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>הודעה</TableHead>
                  <TableHead>מספר הספק</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell>
                      {format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate" title={notification.message_text}>
                        {notification.message_text}
                      </div>
                    </TableCell>
                    <TableCell>{notification.sales_agent_phone}</TableCell>
                    <TableCell>
                      <Badge variant={notification.was_sent ? "success" : "secondary"}>
                        {notification.was_sent ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            נשלח
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            ממתין
                          </div>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!notification.was_sent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsSent(notification.id)}
                          disabled={updateNotificationStatus.isPending}
                        >
                          סמן כנשלח
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
