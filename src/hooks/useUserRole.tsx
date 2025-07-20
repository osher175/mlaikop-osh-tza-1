
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'free_user' | 'pro_starter_user' | 'smart_master_user' | 'elite_pilot_user' | 'OWNER';

export const useUserRole = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole>('free_user');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserRole();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchUserRole = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleData) {
        setUserRole(roleData.role as UserRole);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasRole = (role: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      'free_user': 1,
      'pro_starter_user': 2,
      'smart_master_user': 3,
      'elite_pilot_user': 4,
      'OWNER': 5,
      'admin': 6,
    };

    return roleHierarchy[userRole] >= roleHierarchy[role];
  };

  const getRoleDisplayName = (role: UserRole): string => {
    const roleNames: Record<UserRole, string> = {
      'free_user': 'משתמש חינמי',
      'pro_starter_user': 'פרו מתחיל',
      'smart_master_user': 'מאסטר חכם',
      'elite_pilot_user': 'פיילוט עילית',
      'OWNER': 'בעלים',
      'admin': 'מנהל מערכת',
    };

    return roleNames[role] || role;
  };

  const permissions: Record<string, boolean> = {
    canManageProducts: hasRole('OWNER') || hasRole('smart_master_user'),
    canViewReports: hasRole('OWNER') || hasRole('smart_master_user'),
    canManageUsers: hasRole('admin') || hasRole('OWNER'),
    canAccessAdmin: hasRole('admin'),
  };

  return {
    userRole,
    hasRole,
    getRoleDisplayName,
    permissions,
    isLoading,
  };
};
