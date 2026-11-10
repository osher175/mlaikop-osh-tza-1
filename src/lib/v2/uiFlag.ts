// Mlaiko V2 UI flag — frontend-only, presentation only. It never grants permissions.
// Default: legacy UI. Enable per browser with `?ui=v2`, disable with `?ui=legacy`.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'mlaiko.ui.v2';

export const V2_UI_DEFAULT_ENABLED = false;

// URL param takes precedence over localStorage; otherwise the persisted choice applies.
function applyUiParam(search: string): boolean {
  if (typeof window === 'undefined') return V2_UI_DEFAULT_ENABLED;
  try {
    const param = new URLSearchParams(search).get('ui');
    if (param === 'v2') localStorage.setItem(STORAGE_KEY, '1');
    if (param === 'legacy') localStorage.removeItem(STORAGE_KEY);
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? V2_UI_DEFAULT_ENABLED : stored === '1';
  } catch {
    return V2_UI_DEFAULT_ENABLED;
  }
}

export function isV2UiEnabled(): boolean {
  if (typeof window === 'undefined') return V2_UI_DEFAULT_ENABLED;
  return applyUiParam(window.location.search);
}

// Capture `?ui=v2` / `?ui=legacy` at module load so the preference persists even when
// an unauthenticated visitor is redirected to /auth (the redirect strips the query).
if (typeof window !== 'undefined') {
  applyUiParam(window.location.search);
}

/**
 * Router-aware reactive V2 mode. Re-evaluates on every client-side navigation, so
 * switching modes works without a full page refresh. The shell and the dashboard
 * must both consume this hook so they always share the same mode.
 */
export function useV2UiEnabled(): boolean {
  const { search } = useLocation();
  const [enabled, setEnabled] = useState(() => applyUiParam(search));

  useEffect(() => {
    setEnabled(applyUiParam(search));
  }, [search]);

  return enabled;
}
