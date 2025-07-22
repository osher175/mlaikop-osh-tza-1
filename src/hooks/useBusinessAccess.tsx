
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type BusinessContext = {
  business_id: string;
  business_name: string;
  role: 'owner' | 'admin' | 'user';
};

export const useBusinessAccess = () => {
  const { user } = useAuth();
  const [businessContext, setBusinessContext] = useState<BusinessContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBusinessContext = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Get user's business context
        const { data, error } = await supabase
          .from('businesses')
          .select('id, name')
          .eq('owner_id', user.id)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        
        if (data) {
          setBusinessContext({
            business_id: data.id,
            business_name: data.name,
            role: 'owner'
          });
        } else {
          // Check if user is part of a business
          const { data: businessUser, error: businessUserError } = await supabase
            .from('business_users')
            .select('business_id, role, businesses(name)')
            .eq('user_id', user.id)
            .eq('status', 'approved')
            .single();
            
          if (businessUserError && businessUserError.code !== 'PGRST116') {
            throw businessUserError;
          }
          
          if (businessUser) {
            setBusinessContext({
              business_id: businessUser.business_id,
              business_name: businessUser.businesses?.name || 'Unknown Business',
              role: businessUser.role as 'admin' | 'user'
            });
          }
        }
      } catch (err) {
        console.error('Error fetching business context:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBusinessContext();
  }, [user]);

  return { businessContext, isLoading, error };
};
