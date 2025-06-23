
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

export const useBusinessAccess = () => {
  const { user } = useAuth();
  const { userRole, isLoading: roleLoading } = useUserRole();

  const { data: hasAccess, isLoading: accessLoading } = useQuery({
    queryKey: ['business-access', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      console.log('Checking business access for user:', user.email, 'with role:', userRole);
      
      // Admin users always have access
      if (userRole === 'admin') {
        console.log('Admin user has full access');
        return true;
      }
      
      // Check if user has business access via the database function
      const { data, error } = await supabase.rpc('user_has_business_access', {
        user_uuid: user.id
      });
      
      if (error) {
        console.error('Error checking business access:', error);
        return false;
      }
      
      console.log('Business access result:', data);
      return data || false;
    },
    enabled: !!user?.id && !roleLoading,
  });

  const { data: businessContext } = useQuery({
    queryKey: ['business-context', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Admin users don't need business context
      if (userRole === 'admin') {
        return null;
      }
      
      const { data, error } = await supabase.rpc('get_user_business_context', {
        user_uuid: user.id
      });
      
      if (error) {
        console.error('Error getting business context:', error);
        return null;
      }
      
      return data?.[0] || null;
    },
    enabled: !!user?.id && hasAccess && !roleLoading,
  });

  return {
    hasAccess: hasAccess ?? false,
    businessContext,
    isLoading: accessLoading || roleLoading,
  };
};
