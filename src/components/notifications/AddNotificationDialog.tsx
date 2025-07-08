
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useNotificationManagement } from '@/hooks/useNotificationManagement';

interface AddNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddNotificationDialog: React.FC<AddNotificationDialogProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    notification_type: '',
    low_stock_threshold: 5,
    expiration_days_warning: 7,
    whatsapp_to_supplier: false,
    is_active: true
  });

  const { createNotification } = useNotificationManagement();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createNotification.mutateAsync(formData);
      onSuccess();
      setFormData({
        notification_type: '',
        low_stock_threshold: 5,
        expiration_days_warning: 7,
        whatsapp_to_supplier: false,
        is_active: true
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוסף התראה חדשה</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notification_type">סוג התראה</Label>
            <Select
              value={formData.notification_type}
              onValueChange={(value) => setFormData({
                ...formData,
                notification_type: value
              })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר סוג התראה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low_stock">מלאי נמוך</SelectItem>
                <SelectItem value="expiring_soon">תוקף קרוב</SelectItem>
                <SelectItem value="expired">פג תוקף</SelectItem>
                <SelectItem value="unusual_activity">פעילות חריגה</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.notification_type === 'low_stock' && (
            <div className="space-y-2">
              <Label htmlFor="low_stock_threshold">סף מלאי נמוך (יחידות)</Label>
              <Input
                id="low_stock_threshold"
                type="number"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({
                  ...formData,
                  low_stock_threshold: parseInt(e.target.value) || 0
                })}
                min="0"
                required
              />
            </div>
          )}

          {(formData.notification_type === 'expiring_soon' || formData.notification_type === 'expired') && (
            <div className="space-y-2">
              <Label htmlFor="expiration_days_warning">ימי התרעה מראש</Label>
              <Input
                id="expiration_days_warning"
                type="number"
                value={formData.expiration_days_warning}
                onChange={(e) => setFormData({
                  ...formData,
                  expiration_days_warning: parseInt(e.target.value) || 0
                })}
                min="0"
                required
              />
            </div>
          )}

          <div className="flex items-center space-x-2 space-x-reverse">
            <Switch
              id="whatsapp_to_supplier"
              checked={formData.whatsapp_to_supplier}
              onCheckedChange={(checked) => setFormData({
                ...formData,
                whatsapp_to_supplier: checked
              })}
            />
            <Label htmlFor="whatsapp_to_supplier">שלח ווצאפ לספק</Label>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({
                ...formData,
                is_active: checked
              })}
            />
            <Label htmlFor="is_active">התראה פעילה</Label>
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
              type="submit"
              disabled={createNotification.isPending}
            >
              {createNotification.isPending ? 'יוצר...' : 'צור התראה'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
