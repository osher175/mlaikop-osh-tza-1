import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'mlaiko:hide-cost';

/**
 * Shared cost-visibility store.
 * All components using useCostVisibility() re-render instantly when the value
 * changes — no page refresh needed. Persisted in localStorage per browser and
 * synced across tabs via the `storage` event.
 */

const readInitial = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
};

let hiddenState: boolean = readInitial();
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((l) => l());
};

const setHidden = (next: boolean) => {
  if (hiddenState === next) return;
  hiddenState = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    // ignore quota errors
  }
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    const next = e.newValue === null ? true : e.newValue === '1';
    if (next !== hiddenState) {
      hiddenState = next;
      emit();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
};

const getSnapshot = () => hiddenState;
const getServerSnapshot = () => true;

export const useCostVisibility = () => {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    setHidden(!hiddenState);
  }, []);

  const maskCost = useCallback(
    (formatted: string) => (hidden ? '₪●●●' : formatted),
    [hidden],
  );

  return { hidden, toggle, maskCost };
};
