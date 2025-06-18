
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Save, Globe, Mail, Shield, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemSettings {
  siteName: string;
  siteDescription: string;
  maxFileSize: number;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  maintenanceMode: boolean;
  supportEmail: string;
  defaultLanguage: string;
  sessionTimeout: number;
  enableNotifications: boolean;
}

export const AdminSystemSettings: React.FC = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>({
    siteName: 'Mlaiko - מערכת ניהול מלאי',
    siteDescription: 'פלטפורמה מתקדמת לניהול מלאי לעסקים קטנים ובינוניים',
    maxFileSize: 10,
    allowRegistration: true,
    requireEmailVerification: true,
    maintenanceMode: false,
    supportEmail: 'support@mlaiko.com',
    defaultLanguage: 'he',
    sessionTimeout: 24,
    enableNotifications: true,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSettingChange = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // Simulate API call to save settings
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "הגדרות נשמרו בהצלחה",
      description: "השינויים נכנסו לתוקף",
    });
    
    setIsSaving(false);
  };

  const settingSections = [
    {
      title: 'הגדרות כלליות',
      icon: <Globe className="w-5 h-5" />,
      settings: [
        {
          key: 'siteName' as keyof SystemSettings,
          label: 'שם האתר',
          type: 'text',
          description: 'השם שיוצג בכותרת האתר'
        },
        {
          key: 'siteDescription' as keyof SystemSettings,
          label: 'תיאור האתר',
          type: 'textarea',
          description: 'תיאור קצר של האתר'
        },
        {
          key: 'defaultLanguage' as keyof SystemSettings,
          label: 'שפת ברירת מחדל',
          type: 'select',
          options: [
            { value: 'he', label: 'עברית' },
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'العربية' },
          ],
          description: 'השפה הראשית של המערכת'
        },
      ]
    },
    {
      title: 'הגדרות אבטחה',
      icon: <Shield className="w-5 h-5" />,
      settings: [
        {
          key: 'allowRegistration' as keyof SystemSettings,
          label: 'אפשר הרשמה',
          type: 'switch',
          description: 'האם לאפשר למשתמשים חדשים להירשם'
        },
        {
          key: 'requireEmailVerification' as keyof SystemSettings,
          label: 'דרוש אימות אימייל',
          type: 'switch',
          description: 'האם לדרוש אימות כתובת האימייל בהרשמה'
        },
        {
          key: 'sessionTimeout' as keyof SystemSettings,
          label: 'זמן פג תוקף הפעלה (שעות)',
          type: 'number',
          description: 'מספר השעות לאחר מחוסר פעילות'
        },
      ]
    },
    {
      title: 'הגדרות מערכת',
      icon: <Settings className="w-5 h-5" />,
      settings: [
        {
          key: 'maxFileSize' as keyof SystemSettings,
          label: 'גודל קובץ מקסימלי (MB)',
          type: 'number',
          description: 'הגודל המקסימלי לקבצים שמועלים'
        },
        {
          key: 'maintenanceMode' as keyof SystemSettings,
          label: 'מצב תחזוקה',
          type: 'switch',
          description: 'אם פעיל, רק אדמינים יוכלו לגשת למערכת'
        },
        {
          key: 'supportEmail' as keyof SystemSettings,
          label: 'אימייל תמיכה',
          type: 'email',
          description: 'כתובת האימייל לפניות תמיכה'
        },
      ]
    },
    {
      title: 'הגדרות התראות',
      icon: <Bell className="w-5 h-5" />,
      settings: [
        {
          key: 'enableNotifications' as keyof SystemSettings,
          label: 'אפשר התראות',
          type: 'switch',
          description: 'האם לאפשר שליחת התראות למשתמשים'
        },
      ]
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold text-gray-900 font-rubik flex items-center gap-2" dir="rtl">
            <Settings className="w-6 h-6 text-red-500" />
            הגדרות מערכת
          </CardTitle>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-turquoise hover:bg-turquoise/90 font-rubik"
          >
            <Save className="w-4 h-4 ml-2" />
            {isSaving ? 'שומר...' : 'שמור הגדרות'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8" dir="rtl">
        {settingSections.map((section, sectionIndex) => (
          <Card key={sectionIndex} className="border-2 border-gray-100">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2 font-rubik">
                {section.icon}
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {section.settings.map((setting, settingIndex) => (
                <div key={settingIndex} className="space-y-2">
                  <Label htmlFor={setting.key} className="font-semibold font-rubik">
                    {setting.label}
                  </Label>
                  
                  {setting.type === 'text' && (
                    <Input
                      id={setting.key}
                      type="text"
                      value={settings[setting.key] as string}
                      onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                      className="font-rubik"
                    />
                  )}
                  
                  {setting.type === 'email' && (
                    <Input
                      id={setting.key}
                      type="email"
                      value={settings[setting.key] as string}
                      onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                      className="font-rubik"
                    />
                  )}
                  
                  {setting.type === 'number' && (
                    <Input
                      id={setting.key}
                      type="number"
                      value={settings[setting.key] as number}
                      onChange={(e) => handleSettingChange(setting.key, parseInt(e.target.value) || 0)}
                      className="font-rubik"
                    />
                  )}
                  
                  {setting.type === 'textarea' && (
                    <Textarea
                      id={setting.key}
                      value={settings[setting.key] as string}
                      onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                      className="font-rubik"
                      rows={3}
                    />
                  )}
                  
                  {setting.type === 'switch' && (
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Switch
                        id={setting.key}
                        checked={settings[setting.key] as boolean}
                        onCheckedChange={(checked) => handleSettingChange(setting.key, checked)}
                      />
                      <Label htmlFor={setting.key} className="font-rubik cursor-pointer">
                        {(settings[setting.key] as boolean) ? 'פעיל' : 'לא פעיל'}
                      </Label>
                    </div>
                  )}
                  
                  {setting.type === 'select' && setting.options && (
                    <Select
                      value={settings[setting.key] as string}
                      onValueChange={(value) => handleSettingChange(setting.key, value)}
                    >
                      <SelectTrigger className="font-rubik">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {setting.options.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="font-rubik">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {setting.description && (
                    <p className="text-sm text-gray-600 font-rubik">{setting.description}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Status Indicators */}
        <Card className="border-2 border-blue-100 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2 font-rubik">
              <Mail className="w-5 h-5 text-blue-600" />
              סטטוס מערכת
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2"></div>
                <div className="text-sm font-semibold font-rubik">שרת פעיל</div>
              </div>
              <div className="text-center">
                <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2"></div>
                <div className="text-sm font-semibold font-rubik">בסיס נתונים</div>
              </div>
              <div className="text-center">
                <div className="w-4 h-4 bg-yellow-500 rounded-full mx-auto mb-2"></div>
                <div className="text-sm font-semibold font-rubik">שירות אימייל</div>
              </div>
              <div className="text-center">
                <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2"></div>
                <div className="text-sm font-semibold font-rubik">גיבויים</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};
