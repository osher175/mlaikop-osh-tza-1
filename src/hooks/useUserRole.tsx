
import { useEffect, useState } from 'react';
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
  
  // For MVP - freeze role system, everyone gets full permissions
  const userRole: UserRole = 'OWNER';

  // Mock loading state for consistency
  const isLoading = false;

  const hasRole = (requiredRole: UserRole): boolean => {
    // Always return true for MVP - everyone has all permissions
    return true;
  };

  const getRoleDisplayName = (role: UserRole): string => {
    // Always return "בעל עסק" for MVP
    return 'בעל עסק';
  };

  const getRolePermissions = (role: UserRole = userRole): RolePermissions => {
    // Always return full permissions for MVP
    return {
      canAccessBusinessData: true,
      canManageUsers: false,        // Hidden in MVP
      canViewReports: true,
      canManageSettings: true,
      canEditProducts: true,
      canViewProducts: true,
      isPlatformAdmin: false,       // No platform admin in MVP
      canManageInventory: true,
    };
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
