
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserSearchResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  planType: string;
  status: string;
  createdAt: string;
}

export const useUserByEmail = () => {
  const [user, setUser] = useState<UserSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchUser = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setUser(null);

    try {
      // First try to find by email in profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          created_at
        `)
        .eq('id', query)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (profileData) {
        // Get user role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profileData.id)
          .single();

        // Get subscription info
        const { data: subscriptionData } = await supabase
          .from('user_subscriptions')
          .select(`
            status,
            subscription_plans(name)
          `)
          .eq('user_id', profileData.id)
          .eq('status', 'active')
          .single();

        setUser({
          id: profileData.id,
          email: query, // This would normally come from auth.users but we can't query that directly
          firstName: profileData.first_name || '',
          lastName: profileData.last_name || '',
          planType: subscriptionData?.subscription_plans?.name || 'freemium',
          status: subscriptionData?.status || 'inactive',
          createdAt: profileData.created_at,
        });
      } else {
        setError('משתמש לא נמצא');
      }
    } catch (err) {
      console.error('Error searching user:', err);
      setError('שגיאה בחיפוש המשתמש');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    searchUser,
    isLoading,
    error,
  };
};
