
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusiness } from './useBusiness';

export const useBusinessOwnership = () => {
  const { user } = useAuth();
  const { business } = useBusiness();

  const { data: isOwner, isLoading } = useQuery({
    queryKey: ['business-ownership', user?.id, business?.id],
    queryFn: async () => {
      if (!user?.id || !business?.id) return false;
      
      // Check both the business owner_id and the profile's owned_business_id
      const businessOwnership = business.owner_id === user.id;
      
      return businessOwnership;
    },
    enabled: !!user?.id && !!business?.id,
  });

  const { data: hasOwnedBusiness, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['owned-business', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('owned_business_id')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error checking owned business:', error);
        return false;
      }
      
      return !!data?.owned_business_id;
    },
    enabled: !!user?.id,
  });

  return {
    isOwner: isOwner ?? false,
    hasOwnedBusiness: hasOwnedBusiness ?? false,
    isLoading: isLoading || isLoadingProfile,
  };
};
