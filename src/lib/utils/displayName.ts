/**
 * Resolves a user's display name with a strict fallback chain:
 *   1. profiles.display_name
 *   2. profiles.username
 *   3. auth.users.email
 *   4. "משתמש ללא שם"
 *
 * Never displays "null null" or empty strings.
 */
export interface DisplayNameSource {
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
  // Legacy fields still supported as a soft fallback before email,
  // but only when both are non-null and non-empty.
  first_name?: string | null;
  last_name?: string | null;
}

export function getDisplayName(source: DisplayNameSource | null | undefined): string {
  if (!source) return 'משתמש ללא שם';

  const clean = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v).trim();
    if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
    return s;
  };

  const displayName = clean(source.display_name);
  if (displayName) return displayName;

  const username = clean(source.username);
  if (username) return username;

  // Soft legacy fallback: only if at least one of first/last has a real value
  const first = clean(source.first_name);
  const last = clean(source.last_name);
  const composed = [first, last].filter(Boolean).join(' ').trim();
  if (composed) return composed;

  const email = clean(source.email);
  if (email) return email;

  return 'משתמש ללא שם';
}
