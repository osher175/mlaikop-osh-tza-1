
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

interface RolePermissions {
  canAccessBusinessData: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canEditProducts: boolean;
  canViewProducts: boolean;
  isPlatformAdmin: boolean;
  canManageInventory: boolean;
}

export const useUserRole = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [userRole, setUserRole] = useState<UserRole>('free_user');

  // Use profile.role if available, otherwise fall back to user_roles table
  const { data: roleData, isLoading } = useQuery({
    queryKey: ['user-role', user?.id, profile?.role],
    queryFn: async () => {
      if (!user?.id) return null;
      
      console.log('Checking role for user:', user.email);
      
      // First check if profile has role
      if (profile?.role) {
        console.log('Profile role found:', profile.role);
        
        // Map profile roles to user_role enum
        const roleMapping: Record<string, UserRole> = {
          'admin': 'admin',
          'OWNER': 'OWNER',
          'user': 'free_user',
        };
        
        const mappedRole = roleMapping[profile.role] || 'free_user';
        return { role: mappedRole };
      }
      
      // Fallback to user_roles table
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.log('No role found in user_roles table, using default free_user');
        return { role: 'free_user' as UserRole };
      }
      
      console.log('User role found in user_roles table:', data.role);
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (roleData?.role) {
      console.log('Setting user role to:', roleData.role);
      setUserRole(roleData.role);
    }
  }, [roleData]);

  const hasRole = (requiredRole: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      'free_user': 1,
      'pro_starter_user': 2,
      'smart_master_user': 3,
      'elite_pilot_user': 4,
      'OWNER': 5,
      'admin': 6,
    };

    const hasPermission = roleHierarchy[userRole] >= roleHierarchy[requiredRole];
    console.log(`Role check: ${userRole} >= ${requiredRole}? ${hasPermission}`);
    return hasPermission;
  };

  const getRoleDisplayName = (role: UserRole): string => {
    const roleNames: Record<UserRole, string> = {
      'free_user': 'משתמש',
      'pro_starter_user': 'משתמש מתחיל',
      'smart_master_user': 'משתמש מתקדם',
      'elite_pilot_user': 'משתמש עילית',
      'OWNER': 'בעל עסק',
      'admin': 'מנהל מערכת',
    };

    return roleNames[role] || role;
  };

  const getRolePermissions = (role: UserRole = userRole): RolePermissions => {
    switch (role) {
      case 'admin':
        return {
          canAccessBusinessData: false,
          canManageUsers: true,
          canViewReports: false,
          canManageSettings: true,
          canEditProducts: false,
          canViewProducts: false,
          isPlatformAdmin: true,
          canManageInventory: false,
        };
      
      case 'OWNER':
        return {
          canAccessBusinessData: true,
          canManageUsers: true,
          canViewReports: true,
          canManageSettings: true,
          canEditProducts: true,
          canViewProducts: true,
          isPlatformAdmin: false,
          canManageInventory: true,
        };
      
      case 'elite_pilot_user':
      case 'smart_master_user':
        return {
          canAccessBusinessData: true,
          canManageUsers: false,
          canViewReports: true,
          canManageSettings: false,
          canEditProducts: true,
          canViewProducts: true,
          isPlatformAdmin: false,
          canManageInventory: true,
        };
      
      case 'pro_starter_user':
        return {
          canAccessBusinessData: true,
          canManageUsers: false,
          canViewReports: false,
          canManageSettings: false,
          canEditProducts: false,
          canViewProducts: true,
          isPlatformAdmin: false,
          canManageInventory: false,
        };
      
      case 'free_user':
      default:
        return {
          canAccessBusinessData: true,
          canManageUsers: false,
          canViewReports: false,
          canManageSettings: false,
          canEditProducts: false,
          canViewProducts: true,
          isPlatformAdmin: false,
          canManageInventory: false,
        };
    }
  };

  const permissions = getRolePermissions();

  return {
    userRole,
    hasRole,
    getRoleDisplayName,
    getRolePermissions,
    permissions,
    isLoading,
  };
};
