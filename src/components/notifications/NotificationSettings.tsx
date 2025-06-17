
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useForm } from 'react-hook-form';
import { Bell, Package, Calendar, Crown } from 'lucide-react';

interface NotificationSettingsForm {
  low_stock_enabled: boolean;
  expiration_enabled: boolean;
  plan_limit_enabled: boolean;
  low_stock_threshold: number;
  expiration_days_warning: number;
}

export const NotificationSettings: React.FC = () => {
  const { settings, isLoading, createOrUpdateSettings } = useNotificationSettings();
  
  const { register, handleSubmit, watch, setValue, formState: { isDirty } } = useForm<NotificationSettingsForm>({
    defaultValues: {
      low_stock_enabled: settings?.low_stock_enabled ?? true,
      expiration_enabled: settings?.expiration_enabled ?? true,
      plan_limit_enabled: settings?.plan_limit_enabled ?? true,
      low_stock_threshold: settings?.low_stock_threshold ?? 5,
      expiration_days_warning: settings?.expiration_days_warning ?? 7,
    },
    values: settings ? {
      low_stock_enabled: settings.low_stock_enabled,
      expiration_enabled: settings.expiration_enabled,
      plan_limit_enabled: settings.plan_limit_enabled,
      low_stock_threshold: settings.low_stock_threshold,
      expiration_days_warning: settings.expiration_days_warning,
    } : undefined,
  });

  const onSubmit = (data: NotificationSettingsForm) => {
    createOrUpdateSettings.mutate(data);
  };

  if (isLoading) {
    return <div className="text-center p-4">טוען...</div>;
  }

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          הגדרות התראות
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Low Stock Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                <Label htmlFor="low_stock_enabled" className="text-sm font-medium">
                  התראות מלאי נמוך
                </Label>
              </div>
              <Switch
                id="low_stock_enabled"
                checked={watch('low_stock_enabled')}
                onCheckedChange={(checked) => setValue('low_stock_enabled', checked)}
              />
            </div>
            
            {watch('low_stock_enabled') && (
              <div className="mr-6">
                <Label htmlFor="low_stock_threshold" className="text-sm text-muted-foreground">
                  סף מלאי מינימלי (ברירת מחדל)
                </Label>
                <Input
                  id="low_stock_threshold"
                  type="number"
                  min="1"
                  {...register('low_stock_threshold', { valueAsNumber: true })}
                  className="mt-1 w-24"
                />
              </div>
            )}
          </div>

          {/* Expiration Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-red-500" />
                <Label htmlFor="expiration_enabled" className="text-sm font-medium">
                  התראות פג תוקף
                </Label>
              </div>
              <Switch
                id="expiration_enabled"
                checked={watch('expiration_enabled')}
                onCheckedChange={(checked) => setValue('expiration_enabled', checked)}
              />
            </div>
            
            {watch('expiration_enabled') && (
              <div className="mr-6">
                <Label htmlFor="expiration_days_warning" className="text-sm text-muted-foreground">
                  התרע כמה ימים לפני פגיעת התוקף
                </Label>
                <Input
                  id="expiration_days_warning"
                  type="number"
                  min="1"
                  max="365"
                  {...register('expiration_days_warning', { valueAsNumber: true })}
                  className="mt-1 w-24"
                />
              </div>
            )}
          </div>

          {/* Plan Limit Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-blue-500" />
                <Label htmlFor="plan_limit_enabled" className="text-sm font-medium">
                  התראות מגבלות תוכנית
                </Label>
              </div>
              <Switch
                id="plan_limit_enabled"
                checked={watch('plan_limit_enabled')}
                onCheckedChange={(checked) => setValue('plan_limit_enabled', checked)}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={!isDirty || createOrUpdateSettings.isPending}
            className="w-full"
          >
            {createOrUpdateSettings.isPending ? 'שומר...' : 'שמור הגדרות'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
