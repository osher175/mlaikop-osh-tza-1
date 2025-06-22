
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type BusinessUser = Database['public']['Tables']['business_users']['Row'];
type BusinessUserInsert = Database['public']['Tables']['business_users']['Insert'];

export const useBusinessUser = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: businessUser, isLoading } = useQuery({
    queryKey: ['business-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('business_users')
        .select(`
          *,
          business:businesses(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching business user:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  const joinBusiness = useMutation({
    mutationFn: async (data: { businessId: string; fullName: string; position: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('business_users')
        .insert({
          user_id: user.id,
          business_id: data.businessId,
          role: 'EMPLOYEE',
          status: 'pending'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-user'] });
      toast({
        title: "בקשה נשלחה בהצלחה",
        description: "הבקשה שלך נשלחה לאישור בעל העסק",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בשליחת הבקשה",
        variant: "destructive",
      });
    },
  });

  const createBusinessUser = useMutation({
    mutationFn: async (businessId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('business_users')
        .insert({
          user_id: user.id,
          business_id: businessId,
          role: 'OWNER',
          status: 'approved'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-user'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
    },
    onError: (error: any) => {
      console.error('Error creating business user:', error);
    },
  });

  return {
    businessUser,
    isLoading,
    joinBusiness,
    createBusinessUser,
  };
};
