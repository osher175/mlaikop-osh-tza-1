
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useOwnerRole = () => {
  const { user } = useAuth();

  const { data: isOwner, isLoading } = useQuery({
    queryKey: ['owner-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      console.log('Checking OWNER role for user:', user.email);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error);
        return false;
      }
      
      const hasOwnerRole = data?.role === 'OWNER';
      console.log('User role:', data?.role, 'Is OWNER:', hasOwnerRole);
      return hasOwnerRole;
    },
    enabled: !!user?.id,
  });

  return {
    isOwner: isOwner ?? false,
    isLoading,
  };
};
