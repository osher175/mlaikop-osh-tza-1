import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mlaiko:hide-cost';

/**
 * Toggles visibility of cost prices in inventory views.
 * Default: hidden (safer around customers).
 * Persisted in localStorage per browser.
 */
export const useCostVisibility = () => {
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === '1';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0');
    } catch {
      // ignore quota errors
    }
  }, [hidden]);

  const toggle = useCallback(() => setHidden((v) => !v), []);

  const maskCost = useCallback(
    (formatted: string) => (hidden ? '₪●●●' : formatted),
    [hidden],
  );

  return { hidden, toggle, maskCost };
};
