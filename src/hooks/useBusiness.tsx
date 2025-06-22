
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Business = Database['public']['Tables']['businesses']['Row'];
type BusinessInsert = Database['public']['Tables']['businesses']['Insert'];
type BusinessUpdate = Database['public']['Tables']['businesses']['Update'];

export const useBusiness = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: business, isLoading, error } = useQuery({
    queryKey: ['business', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      console.log('Fetching business for user:', user.id);
      
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching business:', error);
        throw error;
      }
      
      console.log('Business fetch result:', data);
      return data;
    },
    enabled: !!user?.id,
  });

  const createBusiness = useMutation({
    mutationFn: async (businessData: Omit<BusinessInsert, 'owner_id'>) => {
      if (!user?.id) {
        console.error('No user ID available for business creation');
        throw new Error('User not authenticated');
      }
      
      console.log('Creating business with data:', { ...businessData, owner_id: user.id });
      
      const { data, error } = await supabase
        .from('businesses')
        .insert({
          ...businessData,
          owner_id: user.id,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating business:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        
        if (error.message?.includes('infinite recursion')) {
          throw new Error('בעיה בהגדרות המערכת - אנא פנה למנהל המערכת');
        }
        if (error.message?.includes('policy')) {
          throw new Error('אין הרשאה ליצור עסק');
        }
        throw error;
      }
      
      console.log('Business created successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business'] });
      queryClient.invalidateQueries({ queryKey: ['business-access'] });
      toast({
        title: "עסק נוצר בהצלחה",
        description: "העסק שלך נוצר במערכת",
      });
    },
    onError: (error: any) => {
      console.error('Business creation mutation error:', error);
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה ביצירת העסק",
        variant: "destructive",
      });
    },
  });

  const updateBusiness = useMutation({
    mutationFn: async (businessData: BusinessUpdate) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (!business?.id) throw new Error('No business found');
      
      console.log('Updating business:', business.id, 'with data:', businessData);
      
      const { data, error } = await supabase
        .from('businesses')
        .update(businessData)
        .eq('id', business.id)
        .eq('owner_id', user.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating business:', error);
        if (error.message?.includes('policy')) {
          throw new Error('אין לך הרשאה לעדכן את הגדרות העסק. נדרש תפקיד OWNER.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business'] });
      toast({
        title: "הפרטים עודכנו בהצלחה",
        description: "פרטי העסק שלך עודכנו במערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בעדכון פרטי העסק",
        variant: "destructive",
      });
      console.error('Error updating business:', error);
    },
  });

  return {
    business,
    isLoading,
    error,
    createBusiness,
    updateBusiness,
  };
};
