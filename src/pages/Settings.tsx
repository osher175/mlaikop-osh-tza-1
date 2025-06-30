
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Key } from 'lucide-react';
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog';

export const Settings: React.FC = () => {
  console.log("Loaded Settings page");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const handleChangePasswordClick = () => {
    console.log('Opening change password dialog from Settings page');
    setChangePasswordOpen(true);
  };

  console.log("Loaded Security section");

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">הגדרות</h1>
            <p className="text-gray-600">נהל את הגדרות החשבון והאבטחה שלך</p>
          </div>
        </div>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              הגדרות אבטחה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={handleChangePasswordClick}
            >
              <Key className="w-4 h-4 ml-2" />
              שינוי סיסמה
            </Button>
            <Button variant="outline" className="w-full justify-start">
              הפעלת אימות דו-שלבי
            </Button>
            <Button variant="outline" className="w-full justify-start">
              היסטוריית התחברויות
            </Button>
          </CardContent>
        </Card>

        {/* Change Password Dialog */}
        <ChangePasswordDialog
          open={changePasswordOpen}
          onOpenChange={setChangePasswordOpen}
        />
      </div>
    </MainLayout>
  );
};
