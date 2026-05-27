import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useUserRole } from '@/hooks/useUserRole';

export type BillingStatus =
  | 'active'
  | 'trial'
  | 'restricted'
  | 'past_due'
  | 'cancelled'
  | 'incomplete'
  | 'none';

const WRITABLE: BillingStatus[] = ['active', 'trial'];

const MESSAGES: Record<BillingStatus, string> = {
  active: '',
  trial: '',
  restricted: 'תקופת הניסיון הסתיימה. ניתן לצפות בנתונים, אך כדי להמשיך לבצע פעולות יש להפעיל מנוי.',
  past_due: 'התשלום נכשל. ניתן לצפות בנתונים, אך כדי להמשיך לבצע פעולות יש לעדכן אמצעי תשלום.',
  cancelled: 'המנוי בוטל. ניתן לצפות בנתונים, אך כדי להמשיך לבצע פעולות יש להפעיל מנוי.',
  incomplete: 'הליך התשלום לא הושלם. ניתן לצפות בנתונים, אך כדי להמשיך לבצע פעולות יש להשלים את ההרשמה.',
  none: 'לא נמצא מנוי פעיל. ניתן לצפות בנתונים, אך כדי להמשיך לבצע פעולות יש להפעיל מנוי.',
};

export const useBusinessBillingStatus = () => {
  const { businessContext, isLoading: ctxLoading } = useBusinessAccess();
  const businessId = businessContext?.business_id as string | undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['business-billing-status', businessId],
    queryFn: async (): Promise<BillingStatus> => {
      if (!businessId) return 'none';
      const { data, error } = await supabase.rpc('business_billing_status', {
        p_business_id: businessId,
      });
      if (error) {
        console.error('business_billing_status error', error);
        return 'none';
      }
      return ((data as string) || 'none') as BillingStatus;
    },
    enabled: !!businessId,
    staleTime: 60_000,
  });

  const status: BillingStatus = data ?? 'none';
  const canWrite = WRITABLE.includes(status);

  return {
    status,
    canWrite,
    isReadOnly: !canWrite,
    loading: ctxLoading || isLoading,
    message: MESSAGES[status] || MESSAGES.none,
    businessId,
  };
};
