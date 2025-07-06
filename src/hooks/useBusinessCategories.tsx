import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type BusinessCategory = Database['public']['Tables']['business_categories']['Row'];

export const useBusinessCategories = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: businessCategories = [], isLoading, error } = useQuery({
    queryKey: ['business-categories', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_categories')
        .select('id, name, description, created_at')
        .order('name');
      
      if (error) {
        console.error('Error fetching business categories:', error);
        throw error;
      }
      
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    businessCategories,
    isLoading,
    error,
  };
};
