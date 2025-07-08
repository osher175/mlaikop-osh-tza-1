
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';

export const useBusinessUsers = () => {
  const { businessContext } = useBusinessAccess();

  const { data: users, isLoading } = useQuery({
    queryKey: ['business-users', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];

      // Get business owner from businesses table
      const { data: ownerData, error: ownerError } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessContext.business_id)
        .single();

      if (ownerError) {
        console.error('Error fetching business owner:', ownerError);
        throw ownerError;
      }

      // Get owner profile
      const { data: ownerProfile, error: ownerProfileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('id', ownerData.owner_id)
        .single();

      if (ownerProfileError) {
        console.error('Error fetching owner profile:', ownerProfileError);
        throw ownerProfileError;
      }

      // Get business members
      const { data: membersData, error: membersError } = await supabase
        .from('business_users')
        .select('user_id, role')
        .eq('business_id', businessContext.business_id)
        .eq('status', 'approved');

      if (membersError) {
        console.error('Error fetching business members:', membersError);
        throw membersError;
      }

      const users = [];

      // Add owner
      if (ownerProfile) {
        users.push({
          id: ownerProfile.id,
          first_name: ownerProfile.first_name,
          last_name: ownerProfile.last_name,
          role: 'בעלים'
        });
      }

      // Get profiles for all members
      if (membersData && membersData.length > 0) {
        const memberIds = membersData.map(member => member.user_id);
        
        const { data: memberProfiles, error: memberProfilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', memberIds);

        if (memberProfilesError) {
          console.error('Error fetching member profiles:', memberProfilesError);
          throw memberProfilesError;
        }

        // Combine member profiles with their roles
        memberProfiles?.forEach(profile => {
          const memberRole = membersData.find(member => member.user_id === profile.id)?.role;
          users.push({
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            role: memberRole || 'משתמש'
          });
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
