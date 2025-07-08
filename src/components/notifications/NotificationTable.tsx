
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, Trash2, Users, Save, X } from 'lucide-react';
import { useNotificationManagement } from '@/hooks/useNotificationManagement';
import { EditNotificationDialog } from './EditNotificationDialog';
import { NotificationTargetsDialog } from './NotificationTargetsDialog';

interface NotificationTableProps {
  notifications: any[];
  isLoading: boolean;
  onRefetch: () => void;
}

export const NotificationTable: React.FC<NotificationTableProps> = ({
  notifications,
  isLoading,
  onRefetch
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<any>({});
  const [editDialogId, setEditDialogId] = useState<string | null>(null);
  const [targetsDialogId, setTargetsDialogId] = useState<string | null>(null);
  
  const { updateNotification, deleteNotification } = useNotificationManagement();

  const getNotificationTypeLabel = (type: string) => {
    const labels = {
      'low_stock': 'מלאי נמוך',
      'expired': 'פג תוקף',
      'expiring_soon': 'תוקף קרוב',
      'unusual_activity': 'פעילות חריגה'
    };
    return labels[type] || type;
  };

  const handleInlineEdit = (notification: any) => {
    setEditingId(notification.id);
    setEditingData({
      low_stock_threshold: notification.low_stock_threshold,
      expiration_days_warning: notification.expiration_days_warning,
      whatsapp_to_supplier: notification.whatsapp_to_supplier,
      is_active: notification.is_active
    });
  };

  const handleSaveInline = async () => {
    if (!editingId) return;
    
    try {
      await updateNotification.mutateAsync({
        id: editingId,
        ...editingData
      });
      setEditingId(null);
      setEditingData({});
      onRefetch();
    } catch (error) {
      console.error('Error updating notification:', error);
    }
  };

  const handleCancelInline = () => {
    setEditingId(null);
    setEditingData({});
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק התראה זו?')) {
      try {
        await deleteNotification.mutateAsync(id);
        onRefetch();
      } catch (error) {
        console.error('Error deleting notification:', error);
      }
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">טוען התראות...</div>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>סוג התראה</TableHead>
              <TableHead>סף רגישות</TableHead>
              <TableHead>ווצאפ לספק</TableHead>
              <TableHead>משתמשים</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((notification) => (
              <TableRow key={notification.id}>
                <TableCell>
                  <Badge variant="outline">
                    {getNotificationTypeLabel(notification.notification_type)}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  {editingId === notification.id ? (
                    <div className="space-y-2">
                      {notification.notification_type === 'low_stock' && (
                        <Input
                          type="number"
                          value={editingData.low_stock_threshold || ''}
                          onChange={(e) => setEditingData({
                            ...editingData,
                            low_stock_threshold: parseInt(e.target.value) || 0
                          })}
                          className="w-20"
                          placeholder="כמות"
                        />
                      )}
                      {(notification.notification_type === 'expiring_soon' || notification.notification_type === 'expired') && (
                        <Input
                          type="number"
                          value={editingData.expiration_days_warning || ''}
                          onChange={(e) => setEditingData({
                            ...editingData,
                            expiration_days_warning: parseInt(e.target.value) || 0
                          })}
                          className="w-20"
                          placeholder="ימים"
                        />
                      )}
                    </div>
                  ) : (
                    <div>
                      {notification.notification_type === 'low_stock' && 
                        `${notification.low_stock_threshold} יחידות`}
                      {(notification.notification_type === 'expiring_soon' || notification.notification_type === 'expired') && 
                        `${notification.expiration_days_warning} ימים`}
                      {notification.notification_type === 'unusual_activity' && 'אוטומטי'}
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  {editingId === notification.id ? (
                    <Switch
                      checked={editingData.whatsapp_to_supplier || false}
                      onCheckedChange={(checked) => setEditingData({
                        ...editingData,
                        whatsapp_to_supplier: checked
                      })}
                    />
                  ) : (
                    <Switch
                      checked={notification.whatsapp_to_supplier}
                      disabled
                    />
                  )}
                </TableCell>

                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTargetsDialogId(notification.id)}
                    className="flex items-center gap-1"
                  >
                    <Users className="h-3 w-3" />
                    ניהול
                  </Button>
                </TableCell>

                <TableCell>
                  {editingId === notification.id ? (
                    <Switch
                      checked={editingData.is_active !== false}
                      onCheckedChange={(checked) => setEditingData({
                        ...editingData,
                        is_active: checked
                      })}
                    />
                  ) : (
                    <Badge variant={notification.is_active ? "success" : "secondary"}>
                      {notification.is_active ? 'פעיל' : 'מושבת'}
                    </Badge>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    {editingId === notification.id ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSaveInline}
                          disabled={updateNotification.isPending}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelInline}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInlineEdit(notification)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(notification.id)}
                          disabled={deleteNotification.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {targetsDialogId && (
        <NotificationTargetsDialog
          notificationId={targetsDialogId}
          open={!!targetsDialogId}
          onOpenChange={(open) => !open && setTargetsDialogId(null)}
          onSuccess={onRefetch}
        />
      )}
    </>
  );
};
