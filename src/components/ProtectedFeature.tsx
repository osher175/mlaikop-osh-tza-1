
import React from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Crown, Zap, Star, Shield } from 'lucide-react';

// Use string literal instead of importing types that don't exist
type UserRole = 'admin' | 'free_user' | 'pro_starter_user' | 'smart_master_user' | 'elite_pilot_user' | 'OWNER';

interface ProtectedFeatureProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredPermission?: string;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export const ProtectedFeature: React.FC<ProtectedFeatureProps> = ({
  children,
  requiredRole,
  requiredPermission,
  fallback,
  showUpgradePrompt = true,
}) => {
  const { hasRole, userRole, getRoleDisplayName, permissions } = useUserRole();

  // Check permission-based access
  if (requiredPermission) {
    if (permissions && permissions[requiredPermission]) {
      return <>{children}</>;
    }
  }
  
  // Check role-based access
  if (requiredRole && hasRole && hasRole(requiredRole)) {
    return <>{children}</>;
  }

  // If both checks fail, show fallback or upgrade prompt
  if (requiredPermission && permissions && !permissions[requiredPermission]) {
    // Permission-based access denied
    if (fallback) {
      return <>{fallback}</>;
    }

    if (!showUpgradePrompt) {
      return null;
    }

    return (
      <Card className="border-2 border-dashed border-gray-300 bg-gray-50" dir="rtl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Lock className="w-6 h-6 text-gray-500" />
          </div>
          <CardTitle className="text-lg">גישה מוגבלת</CardTitle>
          <CardDescription>
            תכונה זו דורשת הרשאות גבוהות יותר
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            התפקיד הנוכחי שלך: {getRoleDisplayName && getRoleDisplayName(userRole)}
          </p>
          <Button className="bg-primary hover:bg-primary-600">
            בקש הרשאה
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Role-based access denied
  if (requiredRole && hasRole && !hasRole(requiredRole)) {
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
          return <Shield className="w-6 h-6 text-red-500" />;
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
            תכונה זו זמינה למשתמשי {getRoleDisplayName && getRoleDisplayName(requiredRole)} ומעלה
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            התפקיד הנוכחי שלך: {getRoleDisplayName && getRoleDisplayName(userRole)}
          </p>
          <Button className="bg-primary hover:bg-primary-600">
            שדרג חשבון
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};
