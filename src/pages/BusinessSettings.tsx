
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings, Building, Bell, Shield, Palette, Save } from 'lucide-react';

export const BusinessSettings: React.FC = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    businessName: 'החנות שלי',
    businessType: 'retail',
    address: 'תל אביב, ישראל',
    phone: '03-1234567',
    email: 'info@mystore.com',
    currency: 'ILS',
    language: 'he',
    notifications: {
      lowStock: true,
      newOrders: true,
      reports: false,
      marketing: true
    },
    inventory: {
      lowStockThreshold: 10,
      autoReorder: false,
      trackExpiration: true
    }
  });

  const handleSave = () => {
    toast({
      title: "ההגדרות נשמרו בהצלחה",
      description: "השינויים שלך עודכנו במערכת",
    });
  };

  const updateSetting = (path: string, value: any) => {
    setSettings(prev => {
      const keys = path.split('.');
      const updated = { ...prev };
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      return updated;
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">הגדרות עסק</h1>
            <p className="text-gray-600">נהל את הגדרות העסק והמערכת שלך</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Business Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  פרטי העסק
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="businessName">שם העסק</Label>
                    <Input
                      id="businessName"
                      value={settings.businessName}
                      onChange={(e) => updateSetting('businessName', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="businessType">סוג עסק</Label>
                    <Select 
                      value={settings.businessType}
                      onValueChange={(value) => updateSetting('businessType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retail">קמעונאות</SelectItem>
                        <SelectItem value="wholesale">סיטונאות</SelectItem>
                        <SelectItem value="restaurant">מסעדה</SelectItem>
                        <SelectItem value="garage">מוסך</SelectItem>
                        <SelectItem value="clothing">ביגוד</SelectItem>
                        <SelectItem value="electronics">אלקטרוניקה</SelectItem>
                        <SelectItem value="other">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">כתובת</Label>
                  <Input
                    id="address"
                    value={settings.address}
                    onChange={(e) => updateSetting('address', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">טלפון</Label>
                    <Input
                      id="phone"
                      value={settings.phone}
                      onChange={(e) => updateSetting('phone', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">אימייל</Label>
                    <Input
                      id="email"
                      type="email"
                      value={settings.email}
                      onChange={(e) => updateSetting('email', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  הגדרות מערכת
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="currency">מטבע</Label>
                    <Select 
                      value={settings.currency}
                      onValueChange={(value) => updateSetting('currency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ILS">שקל ישראלי (₪)</SelectItem>
                        <SelectItem value="USD">דולר אמריקני ($)</SelectItem>
                        <SelectItem value="EUR">יורו (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="language">שפה</Label>
                    <Select 
                      value={settings.language}
                      onValueChange={(value) => updateSetting('language', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="he">עברית</SelectItem>
                        <SelectItem value="en">אנגלית</SelectItem>
                        <SelectItem value="ar">ערבית</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Settings */}
            <Card>
              <CardHeader>
                <CardTitle>הגדרות מלאי</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="lowStockThreshold">סף מלאי נמוך</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    value={settings.inventory.lowStockThreshold}
                    onChange={(e) => updateSetting('inventory.lowStockThreshold', parseInt(e.target.value))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoReorder">הזמנה אוטומטית</Label>
                    <p className="text-sm text-gray-600">הזמן אוטומטית כשהמלאי נמוך</p>
                  </div>
                  <Switch
                    id="autoReorder"
                    checked={settings.inventory.autoReorder}
                    onCheckedChange={(checked) => updateSetting('inventory.autoReorder', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="trackExpiration">מעקב תפוגה</Label>
                    <p className="text-sm text-gray-600">עקוב אחר תאריכי תפוגה</p>
                  </div>
                  <Switch
                    id="trackExpiration"
                    checked={settings.inventory.trackExpiration}
                    onCheckedChange={(checked) => updateSetting('inventory.trackExpiration', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Settings */}
          <div className="space-y-6">
            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  התראות
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lowStock">מלאי נמוך</Label>
                  <Switch
                    id="lowStock"
                    checked={settings.notifications.lowStock}
                    onCheckedChange={(checked) => updateSetting('notifications.lowStock', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="newOrders">הזמנות חדשות</Label>
                  <Switch
                    id="newOrders"
                    checked={settings.notifications.newOrders}
                    onCheckedChange={(checked) => updateSetting('notifications.newOrders', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="reports">דוחות</Label>
                  <Switch
                    id="reports"
                    checked={settings.notifications.reports}
                    onCheckedChange={(checked) => updateSetting('notifications.reports', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="marketing">שיווק</Label>
                  <Switch
                    id="marketing"
                    checked={settings.notifications.marketing}
                    onCheckedChange={(checked) => updateSetting('notifications.marketing', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Security */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  אבטחה
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full">
                  שנה סיסמה
                </Button>
                <Button variant="outline" className="w-full">
                  הפעל אימות דו-שלבי
                </Button>
                <Button variant="outline" className="w-full">
                  נהל התחברויות
                </Button>
              </CardContent>
            </Card>

            {/* Save Button */}
            <Card>
              <CardContent className="p-6">
                <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary-600">
                  <Save className="w-4 h-4 ml-2" />
                  שמור הגדרות
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
