import { useCallback } from 'react';
import { useBusinessBillingStatus } from '@/hooks/useBusinessBillingStatus';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

/**
 * Centralized helper to gate write actions behind billing status.
 * Returns canWrite/isReadOnly flags plus a `guard(action)` wrapper that
 * shows a toast + optional /subscribe redirect when blocked.
 */
export const useRequireCanWriteAction = () => {
  const { canWrite, isReadOnly, status, message } = useBusinessBillingStatus();
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const navigate = useNavigate();

  const isOwner = !!businessContext?.is_owner;

  const tooltipMessage = isOwner
    ? 'פעולה זו זמינה לאחר הפעלת מנוי. לחץ לעמוד המנוי.'
    : 'פעולה זו זמינה לאחר הפעלת מנוי. פנה למנהל העסק להפעלת המנוי.';

  const blockedClick = useCallback(() => {
    toast({
      title: 'פעולה חסומה',
      description: tooltipMessage,
      variant: 'destructive',
    });
    if (isOwner) navigate('/subscribe');
  }, [toast, navigate, isOwner, tooltipMessage]);

  const guard = useCallback(
    <T extends (...args: any[]) => any>(fn: T) => {
      return ((...args: Parameters<T>) => {
        if (!canWrite) {
          blockedClick();
          return undefined;
        }
        return fn(...args);
      }) as T;
    },
    [canWrite, blockedClick]
  );

  return {
    canWrite,
    isReadOnly,
    status,
    message,
    isOwner,
    tooltipMessage,
    blockedClick,
    guard,
  };
};
