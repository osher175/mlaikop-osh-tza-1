import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isValidUUID } from '@/lib/utils/businessId';
import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

export interface BusinessEntry {
  business_id: string;
  business_name: string;
  user_role: string;
  is_owner: boolean;
}

/**
 * Single source of truth for the active business.
 * Fetches user's businesses via the DB function `get_user_business_context`.
 * Automatically selects the first business if the user belongs to exactly one.
 */
export const useActiveBusiness = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['user-businesses', user?.id],
    queryFn: async (): Promise<BusinessEntry[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase.rpc('get_user_business_context', {
        user_uuid: user.id,
      });

      if (error) {
        console.error('[useActiveBusiness] RPC error:', error);
        return [];
      }

      // Filter out any rows that don't have a valid UUID business_id
      const valid = (data || []).filter(
        (row: any) => row.business_id && isValidUUID(row.business_id)
      );

      return valid as BusinessEntry[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Auto-select: first (or only) business
  const activeBusiness: BusinessEntry | null = businesses.length > 0 ? businesses[0] : null;
  const activeBusinessId: string | null = activeBusiness?.business_id ?? null;

  /**
   * Validates and returns active business_id, or shows a toast and returns null.
   * Use this before any Supabase call that requires business_id.
   */
  const requireBusinessId = useCallback((): string | null => {
    if (!activeBusinessId || !isValidUUID(activeBusinessId)) {
      console.error('[useActiveBusiness] No valid business_id available', {
        activeBusinessId,
        userId: user?.id,
        businessCount: businesses.length,
      });
      toast({
        title: 'בחר עסק לפני ביצוע פעולה',
        description: 'לא נמצא עסק פעיל. יש להירשם או לבחור עסק.',
        variant: 'destructive',
      });
      return null;
    }
    return activeBusinessId;
  }, [activeBusinessId, businesses.length, user?.id, toast]);

  return {
    /** The currently active business (auto-selected) */
    activeBusiness,
    /** Validated UUID string of the active business, or null */
    activeBusinessId,
    /** All businesses the user belongs to */
    businesses,
    /** True while loading */
    isLoading,
    /** Call before mutations — shows toast if missing and returns null */
    requireBusinessId,
  };
};
