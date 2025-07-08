
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

export const useBusinessUsers = () => {
  const { businessContext } = useBusinessAccess();

  const { data: users, isLoading } = useQuery({
    queryKey: ['business-users', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];

      // Get business owner
      const { data: ownerData, error: ownerError } = await supabase
        .from('businesses')
        .select(`
          owner_id,
          profiles!businesses_owner_id_fkey (
            id,
            first_name,
            last_name
          )
        `)
        .eq('id', businessContext.business_id)
        .single();

      if (ownerError) {
        console.error('Error fetching business owner:', ownerError);
        throw ownerError;
      }

      // Get business members
      const { data: membersData, error: membersError } = await supabase
        .from('business_users')
        .select(`
          user_id,
          role,
          profiles!business_users_user_id_fkey (
            id,
            first_name,
            last_name
          )
        `)
        .eq('business_id', businessContext.business_id)
        .eq('status', 'approved');

      if (membersError) {
        console.error('Error fetching business members:', membersError);
        throw membersError;
      }

      const users = [];

      // Add owner
      if (ownerData?.profiles) {
        users.push({
          id: ownerData.profiles.id,
          first_name: ownerData.profiles.first_name,
          last_name: ownerData.profiles.last_name,
          role: 'בעלים'
        });
      }

      // Add members
      if (membersData) {
        membersData.forEach(member => {
          if (member.profiles) {
            users.push({
              id: member.profiles.id,
              first_name: member.profiles.first_name,
              last_name: member.profiles.last_name,
              role: member.role
            });
          }
        });
      }

      return users;
    },
    enabled: !!businessContext?.business_id,
  });

  return {
    users,
    isLoading,
  };
};
