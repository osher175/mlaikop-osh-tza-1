
import React from 'react';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useUserRole } from '@/hooks/useUserRole';
import { OnboardingDecision } from '@/pages/OnboardingDecision';
import { Loader2 } from 'lucide-react';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { hasAccess, isLoading: businessAccessLoading } = useBusinessAccess();
  const { userRole, isLoading: roleLoading } = useUserRole();

  const isLoading = businessAccessLoading || roleLoading;

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

  // Admin users should go directly to admin panel
  if (userRole === 'admin') {
    console.log('Admin user detected, allowing access to admin panel');
    return <>{children}</>;
  }

  // עבור משתמשים רגילים - אל תחסום גישה מיידית, תן להם אפשרות לגשת לתוכן
  // רק אם באמת אין להם גישה ואין להם עסק, תציג את עמוד ההכנסה לעסק
  if (!hasAccess) {
    console.log('User does not have business access, showing onboarding');
    return <OnboardingDecision />;
  }

  return <>{children}</>;
};
