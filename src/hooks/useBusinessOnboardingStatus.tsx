import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Returns the user's onboarding state for the new progressive flow.
 * - hasBusiness: user has at least one business (owner or member)
 * - onboardingCompleted: that business has finished onboarding
 * - businessId: the business in question (if any)
 * Admins always get { hasBusiness: true, onboardingCompleted: true }.
 */
export const useBusinessOnboardingStatus = () => {
  const { user } = useAuth();
  const { userRole, isLoading: roleLoading } = useUserRole();

  const query = useQuery({
    queryKey: ['business-onboarding-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return { hasBusiness: false, onboardingCompleted: false, businessId: null as string | null };

      // Owned business takes precedence
      const { data: owned } = await supabase
        .from('businesses')
        .select('id, onboarding_completed')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (owned) {
        return {
          hasBusiness: true,
          onboardingCompleted: owned.onboarding_completed === true,
          businessId: owned.id,
        };
      }

      // Membership fallback
      const { data: membership } = await supabase
        .from('user_businesses')
        .select('business_id, businesses!inner(id, onboarding_completed)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (membership?.businesses) {
        const b: any = membership.businesses;
        return {
          hasBusiness: true,
          onboardingCompleted: b.onboarding_completed === true,
          businessId: b.id,
        };
      }

      return { hasBusiness: false, onboardingCompleted: false, businessId: null };
    },
    enabled: !!user?.id && !roleLoading && userRole !== 'admin',
    staleTime: 0,
  });

  if (userRole === 'admin') {
    return { hasBusiness: true, onboardingCompleted: true, businessId: null, isLoading: false };
  }

  return {
    hasBusiness: query.data?.hasBusiness ?? false,
    onboardingCompleted: query.data?.onboardingCompleted ?? false,
    businessId: query.data?.businessId ?? null,
    isLoading: roleLoading || query.isLoading,
  };
};
