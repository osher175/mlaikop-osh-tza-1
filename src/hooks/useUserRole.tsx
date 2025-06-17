
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

export const useUserRole = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole>('free_user');

  const { data: roleData, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.log('No role found, using default free_user');
        return { role: 'free_user' as UserRole };
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (roleData?.role) {
      setUserRole(roleData.role);
    }
  }, [roleData]);

  const hasRole = (requiredRole: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      'free_user': 1,
      'pro_starter_user': 2,
      'smart_master_user': 3,
      'elite_pilot_user': 4,
      'admin': 5,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  };

  const getRoleDisplayName = (role: UserRole): string => {
    const roleNames: Record<UserRole, string> = {
      'free_user': 'משתמש חינם',
      'pro_starter_user': 'פרו התחלתי',
      'smart_master_user': 'מאסטר חכם',
      'elite_pilot_user': 'פיילוט עילית',
      'admin': 'מנהל',
    };

    return roleNames[role] || role;
  };

  return {
    userRole,
    hasRole,
    getRoleDisplayName,
    isLoading,
  };
};
