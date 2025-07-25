
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserRole } from '@/hooks/useUserRole';

export const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { userRole, permissions, getRoleDisplayName } = useUserRole();

  const handleGoHome = () => {
    // הפניה לפי תפקיד המשתמש
    if (permissions.isPlatformAdmin) {
      navigate('/admin/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-16 w-16 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            גישה לא מורשית
          </CardTitle>
          <CardDescription className="text-gray-600">
            אין לך הרשאה לגשת לעמוד זה
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>התפקיד שלך:</strong> {getRoleDisplayName(userRole)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ({userRole})
            </p>
          </div>
          <p className="text-sm text-gray-500">
            אם אתה חושב שזו טעות, אנא פנה למנהל המערכת
          </p>
          <Button onClick={handleGoHome} className="w-full">
            <ArrowRight className="w-4 h-4 ml-2" />
            חזור לתפקיד שלי
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
