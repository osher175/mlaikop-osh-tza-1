
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

type BusinessUserWithProfile = {
  id: string;
  user_id: string;
  business_id: string;
  role: string;
  status: string;
  joined_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
};

export const useBusinessMembers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingMembers, isLoading } = useQuery({
    queryKey: ['business-pending-members', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get business owned by current user
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .single();
      
      if (businessError || !business) {
        console.log('No business found for user:', user.email);
        return [];
      }
      
      // Get pending business users with their profiles
      const { data: businessUsers, error } = await supabase
        .from('business_users')
        .select(`
          *,
          profiles(first_name, last_name)
        `)
        .eq('business_id', business.id)
        .eq('status', 'pending');
      
      if (error) {
        console.error('Error fetching pending members:', error);
        throw error;
      }
      
      // Filter out admin user based on user_id if we know it
      // Since we can't directly query by email, we'll handle this in the component
      return businessUsers || [];
    },
    enabled: !!user?.id,
  });

  const approveMember = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const { error } = await supabase
        .from('business_users')
        .update({
          status: 'approved',
          role: role,
        })
        .eq('id', memberId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-pending-members'] });
      toast({
        title: "חבר צוות אושר בהצלחה",
        description: "המשתמש יכול כעת לגשת למערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה באישור חבר צוות",
        description: error.message || "אירעה שגיאה באישור המשתמש",
        variant: "destructive",
      });
    },
  });

  const rejectMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('business_users')
        .update({ status: 'rejected' })
        .eq('id', memberId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-pending-members'] });
      toast({
        title: "בקשה נדחתה",
        description: "הבקשה להצטרפות נדחתה בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בדחיית בקשה",
        description: error.message || "אירעה שגיאה בדחיית הבקשה",
        variant: "destructive",
      });
    },
  });

  return {
    pendingMembers: pendingMembers || [],
    isLoading,
    approveMember,
    rejectMember,
  };
};
