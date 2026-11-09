// Mlaiko V2 UI flag — frontend-only, presentation only. It never grants permissions.
// Default: legacy UI. Enable per browser with `?ui=v2`, disable with `?ui=legacy`.
const STORAGE_KEY = 'mlaiko.ui.v2';

export const V2_UI_DEFAULT_ENABLED = false;

export function isV2UiEnabled(): boolean {
  if (typeof window === 'undefined') return V2_UI_DEFAULT_ENABLED;
  try {
    const param = new URLSearchParams(window.location.search).get('ui');
    if (param === 'v2') localStorage.setItem(STORAGE_KEY, '1');
    if (param === 'legacy') localStorage.removeItem(STORAGE_KEY);
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? V2_UI_DEFAULT_ENABLED : stored === '1';
  } catch {
    return V2_UI_DEFAULT_ENABLED;
  }
}
