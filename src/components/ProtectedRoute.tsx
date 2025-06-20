
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlanSelection } from '@/hooks/usePlanSelection';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { needsPlanSelection, isLoading: planCheckLoading } = usePlanSelection();

  if (loading || profileLoading || planCheckLoading) {
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
    window.location.href = '/auth';
    return null;
  }

  // Admin users bypass all restrictions
  if (profile?.role === 'admin') {
    console.log('Admin access granted');
    return <>{children}</>;
  }

  // Check if user needs to select a plan
  if (needsPlanSelection) {
    console.log('Redirecting to subscriptions for plan selection');
    window.location.href = '/subscriptions';
    return null;
  }

  return <>{children}</>;
};
