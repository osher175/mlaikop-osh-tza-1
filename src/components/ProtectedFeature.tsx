
import React from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Crown, Zap, Star } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

interface ProtectedFeatureProps {
  children: React.ReactNode;
  requiredRole: UserRole;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export const ProtectedFeature: React.FC<ProtectedFeatureProps> = ({
  children,
  requiredRole,
  fallback,
  showUpgradePrompt = true,
}) => {
  const { hasRole, userRole, getRoleDisplayName } = useUserRole();

  if (hasRole(requiredRole)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'pro_starter_user':
        return <Crown className="w-6 h-6 text-amber-500" />;
      case 'smart_master_user':
        return <Zap className="w-6 h-6 text-blue-500" />;
      case 'elite_pilot_user':
        return <Star className="w-6 h-6 text-purple-500" />;
      case 'admin':
        return <Lock className="w-6 h-6 text-red-500" />;
      default:
        return <Lock className="w-6 h-6 text-gray-500" />;
    }
  };

  return (
    <Card className="border-2 border-dashed border-gray-300 bg-gray-50" dir="rtl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          {getRoleIcon(requiredRole)}
        </div>
        <CardTitle className="text-lg">תכונה מוגבלת</CardTitle>
        <CardDescription>
          תכונה זו זמינה למשתמשי {getRoleDisplayName(requiredRole)} ומעלה
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-gray-600 mb-4">
          התפקיד הנוכחי שלך: {getRoleDisplayName(userRole)}
        </p>
        <Button className="bg-primary hover:bg-primary-600">
          שדרג חשבון
        </Button>
      </CardContent>
    </Card>
  );
};
