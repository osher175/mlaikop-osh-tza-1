import React from 'react';
import { Loader2 } from 'lucide-react';
import { useBusinessOnboardingStatus } from '@/hooks/useBusinessOnboardingStatus';
import { OnboardingDecision } from '@/pages/OnboardingDecision';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { hasBusiness, onboardingCompleted, isLoading } = useBusinessOnboardingStatus();

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

  // No business yet, or onboarding not finished → show progressive wizard
  if (!hasBusiness || !onboardingCompleted) {
    return <OnboardingDecision />;
  }

  return <>{children}</>;
};
