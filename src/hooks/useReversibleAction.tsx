import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const STORAGE_KEY = 'mlaiko:last-reversible-action';
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export interface ReversibleAction {
  action_id: string;
  product_name: string;
  quantity: number; // absolute
  action_type: 'remove' | 'sale';
  created_at: string; // ISO
}

const read = (): ReversibleAction | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReversibleAction;
    if (!parsed?.created_at) return null;
    if (Date.now() - new Date(parsed.created_at).getTime() > WINDOW_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const write = (a: ReversibleAction | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (a) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    else window.sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('mlaiko:reversible-changed'));
  } catch {
    // ignore
  }
};

export const rememberReversibleAction = (a: ReversibleAction) => write(a);

/**
 * Tracks the last reversible sale/remove action for the current session and
 * exposes a countdown + reverse mutation. Auto-clears after 10 minutes.
 */
export const useReversibleAction = () => {
  const [action, setAction] = useState<ReversibleAction | null>(() => read());
  const [now, setNow] = useState(() => Date.now());
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () => setAction(read());
    window.addEventListener('mlaiko:reversible-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('mlaiko:reversible-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  useEffect(() => {
    if (!action) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [action]);

  const msRemaining = action
    ? Math.max(0, WINDOW_MS - (now - new Date(action.created_at).getTime()))
    : 0;

  useEffect(() => {
    if (action && msRemaining === 0) {
      write(null);
      setAction(null);
    }
  }, [action, msRemaining]);

  const reverse = useCallback(async () => {
    if (!action) return;
    const { error } = await supabase.rpc('reverse_inventory_action', {
      p_action_id: action.action_id,
    });
    if (error) {
      toast.error('לא הצלחנו לבטל את הפעולה', { description: error.message });
      return;
    }
    toast.success('הפעולה בוטלה', {
      description: `המלאי של ${action.product_name} שוחזר`,
    });
    write(null);
    setAction(null);
    // Refresh all affected views
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['bi-analytics'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-reports'] });
  }, [action, queryClient]);

  const clear = useCallback(() => {
    write(null);
    setAction(null);
  }, []);

  return { action, msRemaining, reverse, clear };
};
