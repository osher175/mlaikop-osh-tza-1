
import React from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

interface ProtectedFeatureProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredPermission?: keyof ReturnType<typeof useUserRole>['permissions'];
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export const ProtectedFeature: React.FC<ProtectedFeatureProps> = ({
  children,
  requiredRole,
  requiredPermission,
  fallback,
  showUpgradePrompt = true,
}) => {
  // For MVP - always allow access, no role/permission checks
  return <>{children}</>;
};
