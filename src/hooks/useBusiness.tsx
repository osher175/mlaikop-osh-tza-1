
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Define local types
interface Business {
  id: string;
  name: string;
  owner_id: string;
  business_category_id?: string;
  industry?: string;
  business_type?: string;
  employee_count?: number;
  avg_monthly_revenue?: number;
  address?: string;
  phone?: string;
  official_email?: string;
  plan_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface CreateBusinessData {
  name: string;
  owner_id: string;
  business_category_id?: string;
  industry?: string;
  business_type?: string;
  employee_count?: number;
  avg_monthly_revenue?: number;
  address?: string;
  phone?: string;
  official_email?: string;
}

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
      
      if (error) {
        console.error('Error fetching business:', error);
        return null;
      }
      
      return data as Business;
    },
    enabled: !!user?.id,
  });

  const createBusinessMutation = useMutation({
    mutationFn: async (businessData: CreateBusinessData) => {
      const { data, error } = await supabase
        .from('businesses')
        .insert([businessData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business'] });
      toast({
        title: 'עסק נוצר בהצלחה',
        description: 'העסק שלך נוצר במערכת',
      });
    },
    onError: (error) => {
      console.error('Error creating business:', error);
      toast({
        title: 'שגיאה ביצירת העסק',
        description: 'אירעה שגיאה ביצירת העסק. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  const updateBusinessMutation = useMutation({
    mutationFn: async (businessData: Partial<Business>) => {
      if (!business?.id) throw new Error('No business to update');
      
      const { data, error } = await supabase
        .from('businesses')
        .update(businessData)
        .eq('id', business.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business'] });
      toast({
        title: 'עסק עודכן בהצלחה',
        description: 'פרטי העסק עודכנו במערכת',
      });
    },
    onError: (error) => {
      console.error('Error updating business:', error);
      toast({
        title: 'שגיאה בעדכון העסק',
        description: 'אירעה שגיאה בעדכון העסק. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  return {
    business,
    isLoading,
    error,
    createBusiness: createBusinessMutation.mutate,
    updateBusiness: updateBusinessMutation.mutate,
    isCreating: createBusinessMutation.isPending,
    isUpdating: updateBusinessMutation.isPending,
  };
};
