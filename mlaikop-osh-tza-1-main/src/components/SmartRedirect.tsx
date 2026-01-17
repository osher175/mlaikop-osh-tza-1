
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

export const SmartRedirect: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { userRole, isLoading: roleLoading } = useUserRole();

  const isLoading = authLoading || roleLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin users should be redirected to admin panel
  if (userRole === 'admin') {
    console.log('SmartRedirect: Admin user detected, redirecting to /admin');
    return <Navigate to="/admin" replace />;
  }

  // Business users go to dashboard
  return <Navigate to="/dashboard" replace />;
};
