
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteWithRoleProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'OWNER' | 'elite_pilot_user' | 'smart_master_user' | 'pro_starter_user';
  requireBusinessAccess?: boolean;
}

export const ProtectedRouteWithRole: React.FC<ProtectedRouteWithRoleProps> = ({ 
  children, 
  requiredRole,
  requireBusinessAccess = false 
}) => {
  const { userRole, permissions, isLoading } = useUserRole();

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

  // Check if user has the required role
  if (requiredRole) {
    const hasRequiredRole = (() => {
      switch (requiredRole) {
        case 'admin':
          return permissions.isPlatformAdmin;
        case 'OWNER':
          return permissions.canManageSettings || permissions.isPlatformAdmin;
        case 'elite_pilot_user':
        case 'smart_master_user':
        case 'pro_starter_user':
          return permissions.canAccessBusinessData || permissions.isPlatformAdmin;
        default:
          return false;
      }
    })();

    if (!hasRequiredRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check if business access is required
  if (requireBusinessAccess && !permissions.canAccessBusinessData && !permissions.isPlatformAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
