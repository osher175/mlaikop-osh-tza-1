
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
      
      // Check if user owns a business
      const { data: ownedBusiness, error: ownerError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .single();
      
      if (!ownerError && ownedBusiness) {
        console.log('User owns a business:', ownedBusiness.id);
        return true;
      }
      
      // Check if user is a member of a business
      const { data: businessMember, error: memberError } = await supabase
        .from('business_users')
        .select('business_id')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .single();
      
      if (!memberError && businessMember) {
        console.log('User is a member of business:', businessMember.business_id);
        return true;
      }
      
      console.log('User has no business access');
      return false;
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
      
      // First check if user owns a business
      const { data: ownedBusiness, error: ownerError } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('owner_id', user.id)
        .single();
      
      if (!ownerError && ownedBusiness) {
        return {
          business_id: ownedBusiness.id,
          business_name: ownedBusiness.name,
          user_role: 'OWNER',
          is_owner: true
        };
      }
      
      // Then check if user is a business member
      const { data: businessMember, error: memberError } = await supabase
        .from('business_users')
        .select(`
          business_id,
          role,
          businesses!inner(name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .single();
      
      if (!memberError && businessMember) {
        return {
          business_id: businessMember.business_id,
          business_name: businessMember.businesses.name,
          user_role: businessMember.role,
          is_owner: false
        };
      }
      
      return null;
    },
    enabled: !!user?.id && hasAccess && !roleLoading,
  });

  return {
    hasAccess: hasAccess ?? false,
    businessContext,
    isLoading: accessLoading || roleLoading,
  };
};
