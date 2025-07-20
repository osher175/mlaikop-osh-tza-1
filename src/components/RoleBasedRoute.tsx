
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedForAdmin?: boolean;
  allowedForBusiness?: boolean;
  redirectTo?: string;
}

export const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({ 
  children, 
  allowedForAdmin = false,
  allowedForBusiness = false,
  redirectTo = '/unauthorized'
}) => {
  const { permissions, isLoading } = useUserRole();

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

  // Check if admin user is accessing admin routes
  if (permissions.isPlatformAdmin && allowedForAdmin) {
    return <>{children}</>;
  }

  // Check if business user is accessing business routes
  if (!permissions.isPlatformAdmin && allowedForBusiness) {
    return <>{children}</>;
  }

  // Redirect unauthorized access
  return <Navigate to={redirectTo} replace />;
};
