
import React from 'react';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { OnboardingDecision } from '@/pages/OnboardingDecision';
import { Loader2 } from 'lucide-react';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { hasAccess, isLoading } = useBusinessAccess();

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

  // For MVP - if user doesn't have business access, redirect to business creation
  if (!hasAccess) {
    console.log('User does not have business access, redirecting to onboarding');
    return <OnboardingDecision />;
  }

  return <>{children}</>;
};
