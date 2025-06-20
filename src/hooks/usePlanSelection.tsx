
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';

export const usePlanSelection = () => {
  const { user } = useAuth();
  const { userRole, isLoading: roleLoading } = useUserRole();

  const { data: hasPlan, isLoading: planLoading } = useQuery({
    queryKey: ['user-plan-selection', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      // Admin users bypass plan requirement completely
      if (userRole === 'admin') {
        console.log('Admin user detected - bypassing plan requirement');
        return true;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('selected_plan_id')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error checking plan selection:', error);
        return false;
      }
      
      return !!data?.selected_plan_id;
    },
    enabled: !!user?.id && !roleLoading,
  });

  return {
    hasPlan: hasPlan ?? false,
    isLoading: planLoading || roleLoading,
  };
};
