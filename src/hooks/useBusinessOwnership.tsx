
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useBusiness } from './useBusiness';

export const useBusinessOwnership = () => {
  const { user } = useAuth();
  const { business } = useBusiness();

  const { data: isOwner, isLoading } = useQuery({
    queryKey: ['business-ownership', user?.id, business?.id],
    queryFn: async () => {
      if (!user?.id || !business?.id) return false;
      return business.owner_id === user.id;
    },
    enabled: !!user?.id && !!business?.id,
  });

  return {
    isOwner: isOwner ?? false,
    isLoading,
  };
};
