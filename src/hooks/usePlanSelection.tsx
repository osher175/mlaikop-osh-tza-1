
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const usePlanSelection = () => {
  const { user } = useAuth();

  const { data: hasPlan, isLoading } = useQuery({
    queryKey: ['user-plan-selection', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
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
    enabled: !!user?.id,
  });

  return {
    hasPlan: hasPlan ?? false,
    isLoading,
  };
};
