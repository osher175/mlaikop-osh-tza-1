
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { NotificationTable } from './NotificationTable';
import { AddNotificationDialog } from './AddNotificationDialog';
import { useNotificationManagement } from '@/hooks/useNotificationManagement';

export const NotificationManagement: React.FC = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { notifications, isLoading, refetch } = useNotificationManagement();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>הגדרות התראות</CardTitle>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            הוסף התראה חדשה
          </Button>
        </CardHeader>
        <CardContent>
          <NotificationTable 
            notifications={notifications || []}
            isLoading={isLoading}
            onRefetch={refetch}
          />
        </CardContent>
      </Card>

      <AddNotificationDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => {
          refetch();
          setIsAddDialogOpen(false);
        }}
      />
    </div>
  );
};
