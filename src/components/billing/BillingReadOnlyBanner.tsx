import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBusinessBillingStatus } from '@/hooks/useBusinessBillingStatus';
import { useOwnerRole } from '@/hooks/useOwnerRole';

export const BillingReadOnlyBanner: React.FC = () => {
  const { isReadOnly, message, loading, status } = useBusinessBillingStatus();
  const { isOwner } = useOwnerRole();
  const navigate = useNavigate();

  if (loading || !isReadOnly) return null;

  return (
    <div
      dir="rtl"
      className="w-full bg-amber-50 border-b border-amber-300 text-amber-900 px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-50"
      role="alert"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <span className="text-sm font-medium truncate">{message}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="hidden md:inline text-xs px-2 py-1 rounded bg-amber-200/70 flex items-center gap-1">
          <Lock className="h-3 w-3" />
          מצב צפייה בלבד · {status}
        </span>
        {isOwner ? (
          <Button size="sm" onClick={() => navigate('/subscribe')}>
            הפעלת מנוי
          </Button>
        ) : (
          <span className="text-xs">פנה למנהל העסק להפעלת המנוי.</span>
        )}
      </div>
    </div>
  );
};
