
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useBusinessAccess = () => {
  const { user } = useAuth();

  const { data: hasAccess, isLoading: accessLoading } = useQuery({
    queryKey: ['business-access', user?.id],
    queryFn: async () => {
      // For MVP - always return true for authenticated users
      return !!user?.id;
    },
    enabled: !!user?.id,
  });

  const { data: businessContext } = useQuery({
    queryKey: ['business-context', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Get user's business context
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
    isLoading: accessLoading,
  };
};
