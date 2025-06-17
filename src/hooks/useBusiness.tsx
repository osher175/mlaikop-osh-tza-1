
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Business = Database['public']['Tables']['businesses']['Row'];
type BusinessInsert = Database['public']['Tables']['businesses']['Insert'];

export const useBusiness = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: business, isLoading, error } = useQuery({
    queryKey: ['business', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching business:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  const createBusiness = useMutation({
    mutationFn: async (businessData: Omit<BusinessInsert, 'owner_id'>) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('businesses')
        .insert({
          ...businessData,
          owner_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business'] });
      toast({
        title: "עסק נוצר בהצלחה",
        description: "העסק שלך נוצר במערכת",
      });
    },
    onError: (error) => {
      toast({
        title: "שגיאה",
        description: "שגיאה ביצירת העסק",
        variant: "destructive",
      });
      console.error('Error creating business:', error);
    },
  });

  return {
    business,
    isLoading,
    error,
    createBusiness,
  };
};
