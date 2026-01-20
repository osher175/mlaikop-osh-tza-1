
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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

  const { data: roleData, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      console.log('Fetching role for user:', user.email);
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.log('No role found for user:', user.email, 'using default free_user');
        return { role: 'free_user' as UserRole };
      }
      
      console.log('User role found:', data.role, 'for user:', user.email);
      return data;
    },
    enabled: !!user?.id,
  });

  // שימוש ישיר ב-roleData - מונע race condition!
  const userRole: UserRole = roleData?.role ?? 'free_user';

  const hasRole = (requiredRole: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      'free_user': 1,        // User - Product list only
      'pro_starter_user': 2, // User - Product list only  
      'smart_master_user': 3, // Super User - Full business control
      'elite_pilot_user': 4,  // Super User - Full business control
      'OWNER': 5,             // Business Owner - Full business control
      'admin': 6,             // Admin - Platform settings only
    };

    const hasPermission = roleHierarchy[userRole] >= roleHierarchy[requiredRole];
    console.log(`Role check: ${userRole} >= ${requiredRole}? ${hasPermission}`);
    return hasPermission;
  };

  const getRoleDisplayName = (role: UserRole): string => {
    const roleNames: Record<UserRole, string> = {
      'free_user': 'משתמש',
      'pro_starter_user': 'משתמש',
      'smart_master_user': 'משתמש על',
      'elite_pilot_user': 'משתמש על',
      'OWNER': 'בעל עסק',
      'admin': 'מנהל מערכת',
    };

    return roleNames[role] || role;
  };

  const getRolePermissions = (role: UserRole = userRole): RolePermissions => {
    switch (role) {
      case 'admin':
        return {
          canAccessBusinessData: false,    // No access to business data
          canManageUsers: true,           // Platform-level user management
          canViewReports: false,          // No business reports
          canManageSettings: true,        // Platform settings only
          canEditProducts: false,         // No product editing
          canViewProducts: false,         // No product viewing
          isPlatformAdmin: true,          // Full platform access
          canManageInventory: false,      // No inventory management
        };
      
      case 'OWNER':
      case 'smart_master_user':
      case 'elite_pilot_user':
        return {
          canAccessBusinessData: true,    // Full business access
          canManageUsers: true,           // Business user management
          canViewReports: true,           // All reports
          canManageSettings: true,        // Business settings
          canEditProducts: true,          // Full product management
          canViewProducts: true,          // View products
          isPlatformAdmin: false,         // No platform access
          canManageInventory: true,       // Full inventory control
        };
      
      case 'free_user':
      case 'pro_starter_user':
      default:
        return {
          canAccessBusinessData: true,    // Limited business access
          canManageUsers: false,          // No user management
          canViewReports: false,          // No reports
          canManageSettings: true,        // Basic settings access
          canEditProducts: false,         // No product editing
          canViewProducts: true,          // View products only
          isPlatformAdmin: false,         // No platform access
          canManageInventory: false,      // No inventory management
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
