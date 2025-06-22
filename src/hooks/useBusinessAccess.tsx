
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useBusinessAccess = () => {
  const { user } = useAuth();

  const { data: hasAccess, isLoading } = useQuery({
    queryKey: ['business-access', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase.rpc('user_has_business_access', {
        user_uuid: user.id
      });
      
      if (error) {
        console.error('Error checking business access:', error);
        return false;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: businessContext } = useQuery({
    queryKey: ['business-context', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.rpc('get_user_business_context', {
        user_uuid: user.id
      });
      
      if (error) {
        console.error('Error getting business context:', error);
        return null;
      }
      
      return data?.[0] || null;
    },
    enabled: !!user?.id && hasAccess,
  });

  return {
    hasAccess: hasAccess ?? false,
    businessContext,
    isLoading,
  };
};
