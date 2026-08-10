import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

/**
 * Import module step-up PIN.
 *
 * The PIN is NOT an authorization grant: the backend always enforces
 * `can_manage_business_imports()` in RLS and in every import RPC. The PIN adds
 * a second, server-verified unlock step on top of that.
 *
 * The client only ever holds an opaque session token (a random uuid issued by
 * the server). It is stored in sessionStorage, never the PIN itself, and it
 * cannot be used to bypass any backend authorization check.
 */
const tokenKey = (businessId: string) => `mlaiko.import.unlock.${businessId}`;

export interface ImportPinState {
  isConfigured: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  failedAttempts: number;
}

export const useImportPin = () => {
  const { activeBusinessId } = useActiveBusiness();
  const queryClient = useQueryClient();
  const [unlocked, setUnlocked] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const { data: pinState, isLoading: statusLoading } = useQuery({
    queryKey: ['import-pin-status', activeBusinessId],
    queryFn: async (): Promise<ImportPinState> => {
      const { data, error } = await supabase.rpc('import_pin_status', {
        p_business_id: activeBusinessId!,
      });
      if (error) throw error;
      const row = (data as any[])?.[0];
      return {
        isConfigured: !!row?.is_configured,
        isLocked: !!row?.is_locked,
        lockedUntil: row?.locked_until ?? null,
        failedAttempts: row?.failed_attempts ?? 0,
      };
    },
    enabled: !!activeBusinessId,
    staleTime: 0,
  });

  // Revalidate a stored unlock token against the server (sliding 30 min window).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!activeBusinessId) return;
      const token = sessionStorage.getItem(tokenKey(activeBusinessId));
      if (!token) {
        if (!cancelled) { setUnlocked(false); setCheckingSession(false); }
        return;
      }
      const { data, error } = await supabase.rpc('import_pin_session_touch', {
        p_business_id: activeBusinessId,
        p_token: token,
      });
      const valid = !error && !!(data as any[])?.[0]?.valid;
      if (!valid) sessionStorage.removeItem(tokenKey(activeBusinessId));
      if (!cancelled) { setUnlocked(valid); setCheckingSession(false); }
    };
    setCheckingSession(true);
    run();
    return () => { cancelled = true; };
  }, [activeBusinessId]);

  const verifyPin = useCallback(
    async (pin: string): Promise<{ success: boolean; message?: string }> => {
      if (!activeBusinessId) return { success: false, message: 'לא נמצא עסק פעיל' };
      const { data, error } = await supabase.rpc('import_pin_verify', {
        p_business_id: activeBusinessId,
        p_pin: pin,
      });
      if (error) return { success: false, message: error.message };
      const row = (data as any[])?.[0];
      if (row?.success && row?.token) {
        sessionStorage.setItem(tokenKey(activeBusinessId), row.token);
        setUnlocked(true);
        queryClient.invalidateQueries({ queryKey: ['import-pin-status', activeBusinessId] });
        return { success: true };
      }
      queryClient.invalidateQueries({ queryKey: ['import-pin-status', activeBusinessId] });
      if (row?.locked_until) {
        return { success: false, message: 'המודול ננעל זמנית עקב ניסיונות שגויים. נסה שוב מאוחר יותר.' };
      }
      return {
        success: false,
        message: `קוד שגוי. נותרו ${row?.attempts_left ?? 0} ניסיונות.`,
      };
    },
    [activeBusinessId, queryClient]
  );

  const setPin = useCallback(
    async (newPin: string, currentPin?: string): Promise<{ success: boolean; message?: string }> => {
      if (!activeBusinessId) return { success: false, message: 'לא נמצא עסק פעיל' };
      const { error } = await supabase.rpc('import_pin_set', {
        p_business_id: activeBusinessId,
        p_new_pin: newPin,
        p_current_pin: currentPin ?? null,
      });
      if (error) return { success: false, message: error.message };
      sessionStorage.removeItem(tokenKey(activeBusinessId));
      setUnlocked(false);
      queryClient.invalidateQueries({ queryKey: ['import-pin-status', activeBusinessId] });
      return { success: true };
    },
    [activeBusinessId, queryClient]
  );

  const lock = useCallback(async () => {
    if (!activeBusinessId) return;
    const token = sessionStorage.getItem(tokenKey(activeBusinessId));
    sessionStorage.removeItem(tokenKey(activeBusinessId));
    setUnlocked(false);
    await supabase.rpc('import_pin_lock', {
      p_business_id: activeBusinessId,
      p_token: token,
    });
  }, [activeBusinessId]);

  return {
    pinState,
    unlocked,
    isLoading: statusLoading || checkingSession,
    verifyPin,
    setPin,
    lock,
  };
};
