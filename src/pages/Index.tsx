
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Dashboard } from './Dashboard';
import { Onboarding } from './Onboarding';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { needsOnboarding, isLoading: onboardingLoading } = useOnboardingStatus();

  if (authLoading || onboardingLoading) {
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

  // Admin user skip onboarding
  if (user.email === 'oshritzafriri@gmail.com') {
    return (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    );
  }

  // Regular users - check onboarding status
  if (needsOnboarding) {
    return <Onboarding />;
  }

  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
};

export default Index;
