
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useOnboardingStatus = () => {
  const { user } = useAuth();

  const { data: needsOnboarding, isLoading } = useQuery({
    queryKey: ['onboarding-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return true;
      
      // Check if user is admin (skip onboarding)
      if (user.email === 'oshritzafriri@gmail.com') {
        return false;
      }
      
      // Check if user has approved business relationship
      const { data, error } = await supabase
        .from('business_users')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking onboarding status:', error);
      }
      
      // If no approved business relationship found, needs onboarding
      return !data;
    },
    enabled: !!user?.id,
  });

  return {
    needsOnboarding: needsOnboarding ?? true,
    isLoading,
  };
};
