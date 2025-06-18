
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, ArrowLeft } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export const AdminNavigationHelper: React.FC = () => {
  const navigate = useNavigate();
  const { userRole, permissions } = useUserRole();

  console.log('AdminNavigationHelper - Current user role:', userRole);
  console.log('AdminNavigationHelper - Is platform admin:', permissions.isPlatformAdmin);

  if (!permissions.isPlatformAdmin) {
    return null;
  }

  const handleNavigateToAdmin = () => {
    console.log('Navigating to admin settings...');
    navigate('/admin/settings');
  };

  return (
    <Card className="border-2 border-red-200 bg-red-50" dir="rtl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-red-700 font-rubik flex items-center gap-2">
          <Settings className="w-5 h-5" />
          פאנל ניהול מערכת
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-red-600 font-rubik mb-4">
          אתה מנהל מערכת! ניתן לגשת לפאנל הניהול המתקדם כדי לנהל משתמשים ותוכניות מנוי.
        </p>
        <Button 
          onClick={handleNavigateToAdmin}
          className="bg-red-600 hover:bg-red-700 text-white font-rubik"
        >
          <ArrowLeft className="w-4 h-4 ml-2" />
          עבור לפאנל ניהול
        </Button>
      </CardContent>
    </Card>
  );
};
