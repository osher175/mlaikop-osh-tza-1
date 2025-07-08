
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { Bell, AlertTriangle, Calendar } from 'lucide-react';

export const NotificationManagement: React.FC = () => {
  const { settings, isLoading, createOrUpdateSettings } = useNotificationSettings();

  const handleSettingChange = async (key: string, value: any) => {
    try {
      await createOrUpdateSettings.mutateAsync({ [key]: value });
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            הגדרות התראות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">טוען הגדרות...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            הגדרות התראות כלליות
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">התראות מלאי נמוך</Label>
              <p className="text-sm text-muted-foreground">
                קבל התראה כאשר המלאי מגיע לסף שהוגדר
              </p>
            </div>
            <Switch
              checked={settings?.low_stock_enabled || false}
              onCheckedChange={(checked) => handleSettingChange('low_stock_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="threshold">סף מלאי נמוך</Label>
              <p className="text-sm text-muted-foreground">
                כמות יחידות שתפעיל התראת מלאי נמוך
              </p>
            </div>
            <Input
              id="threshold"
              type="number"
              min="0"
              value={settings?.low_stock_threshold || 5}
              onChange={(e) => handleSettingChange('low_stock_threshold', Number(e.target.value))}
              className="w-20"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            התראות פג תוקף
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">התראות פג תוקף</Label>
              <p className="text-sm text-muted-foreground">
                קבל התראה לפני שמוצרים פגים תוקף
              </p>
            </div>
            <Switch
              checked={settings?.expiration_enabled || false}
              onCheckedChange={(checked) => handleSettingChange('expiration_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="expiration-days">ימים לפני פג תוקף</Label>
              <p className="text-sm text-muted-foreground">
                כמה ימים לפני פג התוקף להתריע
              </p>
            </div>
            <Input
              id="expiration-days"
              type="number"
              min="1"
              value={settings?.expiration_days_warning || 7}
              onChange={(e) => handleSettingChange('expiration_days_warning', Number(e.target.value))}
              className="w-20"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            התראות מגבלת תוכנית
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">התראות מגבלת תוכנית</Label>
              <p className="text-sm text-muted-foreground">
                קבל התראה כאשר אתה מתקרב למגבלות התוכנית
              </p>
            </div>
            <Switch
              checked={settings?.plan_limit_enabled || false}
              onCheckedChange={(checked) => handleSettingChange('plan_limit_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
