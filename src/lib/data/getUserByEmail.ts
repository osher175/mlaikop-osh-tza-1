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
      // חיפוש לפי אימייל, שם פרטי או שם משפחה
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          first_name,
          last_name,
          created_at
        `)
        .or(`
          email.ilike.%${query}%,
          first_name.ilike.%${query}%,
          last_name.ilike.%${query}%
        `)
        .limit(1)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (profileData) {
        // שליפת תפקיד המשתמש
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profileData.id)
          .single();

        // שליפת חבילת המנוי והסטטוס
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
          email: profileData.email || '',
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
