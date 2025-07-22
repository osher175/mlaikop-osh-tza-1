
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

export type BusinessContext = {
  business_id: string;
  business_name: string;
  user_role: string;
  is_owner: boolean;
};

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
        return {
          business_id: 'admin',
          business_name: 'Administration',
          user_role: 'admin',
          is_owner: true
        } as BusinessContext;
      }
      
      const { data, error } = await supabase.rpc('get_user_business_context', {
        user_uuid: user.id
      });
      
      if (error) {
        console.error('Error getting business context:', error);
        return null;
      }
      
      const context = data?.[0] || null;
      
      // Add the user_role and is_owner properties
      if (context) {
        const userRoleValue = context.user_role || 'user';
        return {
          ...context,
          user_role: userRoleValue,
          is_owner: userRoleValue === 'OWNER'
        } as BusinessContext;
      }
      
      return null;
    },
    enabled: !!user?.id && hasAccess === true && !roleLoading,
  });

  return {
    hasAccess: hasAccess ?? false,
    businessContext,
    isLoading: accessLoading || roleLoading,
  };
};
