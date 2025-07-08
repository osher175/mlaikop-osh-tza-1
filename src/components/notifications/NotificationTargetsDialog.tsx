
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useBusinessUsers } from '@/hooks/useBusinessUsers';
import { useNotificationTargets } from '@/hooks/useNotificationTargets';

interface NotificationTargetsDialogProps {
  notificationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const NotificationTargetsDialog: React.FC<NotificationTargetsDialogProps> = ({
  notificationId,
  open,
  onOpenChange,
  onSuccess
}) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const { users, isLoading: usersLoading } = useBusinessUsers();
  const { 
    targets, 
    isLoading: targetsLoading, 
    updateTargets 
  } = useNotificationTargets(notificationId);

  useEffect(() => {
    if (targets) {
      setSelectedUsers(targets.map(t => t.user_id));
    }
  }, [targets]);

  const handleUserToggle = (userId: string, checked: boolean) => {
    setSelectedUsers(prev => 
      checked 
        ? [...prev, userId]
        : prev.filter(id => id !== userId)
    );
  };

  const handleSave = async () => {
    try {
      await updateTargets.mutateAsync({
        notificationId,
        userIds: selectedUsers
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating notification targets:', error);
    }
  };

  if (usersLoading || targetsLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="text-center py-8">טוען משתמשים...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>בחר משתמשים להתראה</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-60 overflow-y-auto">
          {users?.map((user) => (
            <div key={user.id} className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id={user.id}
                checked={selectedUsers.includes(user.id)}
                onCheckedChange={(checked) => handleUserToggle(user.id, !!checked)}
              />
              <Label htmlFor={user.id} className="flex-1">
                {user.first_name} {user.last_name}
                {user.role && (
                  <span className="text-sm text-gray-500 mr-2">
                    ({user.role})
                  </span>
                )}
              </Label>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            ביטול
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateTargets.isPending}
          >
            {updateTargets.isPending ? 'שומר...' : 'שמור'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
