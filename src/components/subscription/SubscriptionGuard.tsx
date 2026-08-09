// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
import React, { useEffect, useRef, useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useBusinessBillingStatus } from '@/hooks/useBusinessBillingStatus';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Crown, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FREE_ACCESS_MODE } from '@/lib/billing/featureFlag';


interface SubscriptionGuardProps {
  children: React.ReactNode;
  requiresSubscription?: boolean;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({
  children,
  requiresSubscription = true,
}) => {
  const { user } = useAuth();
  const { userRole } = useUserRole();
  const { businessContext, isLoading: ctxLoading } = useBusinessAccess();
  const {
    status: businessStatus,
    canWrite: businessCanWrite,
    loading: billingLoading,
    message: billingMessage,
    businessId,
  } = useBusinessBillingStatus();

  // Per-user subscription is kept ONLY for: (a) trial auto-creation for new owners,
  // (b) showing the "X days left" trial banner. Access decision is business-level.
  const {
    subscription,
    isLoading: subLoading,
    daysLeftInTrial,
    createTrialSubscription,
  } = useSubscription();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCreatingTrial, setIsCreatingTrial] = useState(false);
  const trialCreationAttempted = useRef(false);

  const isOwner = !!businessContext?.is_owner;

  // Auto-create trial for new business OWNERS only (employees should not create trials).
  // Skipped while FREE_ACCESS_MODE is on: no subscription rows are created or
  // mutated while enforcement is suspended. Resumes automatically when the flag is off.
  useEffect(() => {
    if (
      !FREE_ACCESS_MODE &&
      user &&
      isOwner &&
      !subLoading &&
      !subscription &&
      requiresSubscription &&
      !trialCreationAttempted.current &&
      !isCreatingTrial
    ) {
      trialCreationAttempted.current = true;
      setIsCreatingTrial(true);
      createTrialSubscription().finally(() => setIsCreatingTrial(false));
    }
  }, [user, isOwner, subscription, subLoading, requiresSubscription, createTrialSubscription, isCreatingTrial]);

  // FREE ACCESS MODE — subscription/payment enforcement is suspended.
  // Authentication (ProtectedRoute), business membership, roles, tenant
  // isolation and RLS are unaffected and still enforced downstream.
  if (FREE_ACCESS_MODE) {
    return <>{children}</>;
  }

  // Loading

  if (ctxLoading || billingLoading || isCreatingTrial || (isOwner && subLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">טוען נתוני מנוי...</p>
        </div>
      </div>
    );
  }

  // Platform admins bypass all subscription checks
  if (userRole === 'admin') {
    return <>{children}</>;
  }

  if (!requiresSubscription) {
    return <>{children}</>;
  }

  // Business-level gate: active or trial → access granted for ALL business members
  if (businessId && businessCanWrite) {
    // Trial countdown banner (owner only — employees don't own the subscription row)
    if (isOwner && subscription?.status === 'trial' && daysLeftInTrial > 0) {
      return (
        <div className="space-y-4">
          <Card
            className={`border-2 ${daysLeftInTrial <= 3 ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}
            dir="rtl"
          >
            <CardContent className="p-4">
              <div className={`flex items-center gap-2 ${daysLeftInTrial <= 3 ? 'text-red-700' : 'text-orange-700'}`}>
                <Crown className="h-5 w-5" />
                <span className="font-medium">
                  {daysLeftInTrial <= 3
                    ? `⚠️ תקופת הניסיון מסתיימת בעוד ${daysLeftInTrial} ימים בלבד!`
                    : `נותרו ${daysLeftInTrial} ימים בתקופת הניסיון החינמית`}
                </span>
              </div>
              <Button
                variant={daysLeftInTrial <= 3 ? 'destructive' : 'outline'}
                size="sm"
                className="mt-2"
                onClick={() => navigate(`/subscribe?userId=${user?.id}&email=${encodeURIComponent(user?.email || '')}`)}
              >
                {daysLeftInTrial <= 3 ? 'שדרג עכשיו!' : 'שדרג עכשיו'}
              </Button>
            </CardContent>
          </Card>
          {children}
        </div>
      );
    }
    return <>{children}</>;
  }

  // Blocked — business has no active/trial subscription
  const isExpired = searchParams.get('expired') === 'true' || businessStatus === 'restricted' || businessStatus === 'cancelled';

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-md w-full" dir="rtl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className={`h-12 w-12 ${isExpired ? 'text-red-500' : 'text-orange-500'}`} />
          </div>
          <CardTitle className="text-xl">
            {isExpired ? 'תקופת הניסיון הסתיימה' : 'נדרש מנוי פעיל'}
          </CardTitle>
          {user && (
            <div className="text-sm text-muted-foreground mt-2">
              <p>משתמש: {user.email}</p>
              {businessContext?.business_name && <p>עסק: {businessContext.business_name}</p>}
            </div>
          )}
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {billingMessage ||
              (isOwner
                ? 'כדי לגשת לתוכן זה, יש צורך במנוי פעיל לעסק.'
                : 'המנוי של העסק אינו פעיל. פנה למנהל העסק להפעלת המנוי.')}
          </p>
          <div className="space-y-2">
            {isOwner && (
              <Button
                onClick={() =>
                  navigate(
                    `/subscribe?userId=${user?.id}&email=${encodeURIComponent(user?.email || '')}&expired=${isExpired}`
                  )
                }
                className="w-full"
              >
                בחר תוכנית מנוי
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/profile')} className="w-full">
              חזור לפרופיל
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};