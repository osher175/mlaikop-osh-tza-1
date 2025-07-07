
import React from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

interface ProtectedRouteWithRoleProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredPermission?: string;
  redirectTo?: string;
}

export const ProtectedRouteWithRole: React.FC<ProtectedRouteWithRoleProps> = ({
  children,
  requiredRole,
  requiredPermission,
  redirectTo = '/unauthorized'
}) => {
  const { userRole, permissions, isLoading: roleLoading } = useUserRole();
  const { hasAccess, isLoading: accessLoading } = useBusinessAccess();

  const isLoading = roleLoading || accessLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">בודק הרשאות...</p>
        </div>
      </div>
    );
  }

  // Admin users bypass most restrictions
  if (userRole === 'admin') {
    return <>{children}</>;
  }

  // Check if user has business access (except for admin)
  if (!hasAccess) {
    return <Navigate to="/onboarding" replace />;
  }

  // Check required role
  if (requiredRole) {
    const roleHierarchy: Record<UserRole, number> = {
      'free_user': 1,
      'pro_starter_user': 2,
      'smart_master_user': 3,
      'elite_pilot_user': 4,
      'OWNER': 5,
      'admin': 6,
    };

    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  // Check required permission
  if (requiredPermission) {
    // @ts-ignore - checking dynamic permission key
    if (!permissions[requiredPermission]) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
};
