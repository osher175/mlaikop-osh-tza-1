
import React from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

interface AdminNavigationHelperProps {
  children: React.ReactNode;
}

export const AdminNavigationHelper: React.FC<AdminNavigationHelperProps> = ({ children }) => {
  const { userRole, isLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && userRole !== 'admin') {
      // Redirect non-admin users to dashboard
      navigate('/dashboard');
    }
  }, [userRole, isLoading, navigate]);

  // Show loading while checking permissions
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">בודק הרשאות...</p>
        </div>
      </div>
    );
  }

  // Only render children for admin users
  if (userRole === 'admin') {
    return <>{children}</>;
  }

  // Return null for non-admin users (they will be redirected)
  return null;
};
