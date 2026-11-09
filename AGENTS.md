# Architecture rules

- Keep home-screen support manifest-only, without an app-shell service worker, unless offline use is explicitly requested; this avoids stale preview caches.
- Derive install icons from the existing favicon as full-bleed squares served as real files (/apple-touch-icon.png, /icons/*); iOS requests that root path directly.
- Keep unapproved SQL proposals outside supabase/migrations; the migration tool owns executable migration history, preventing accidental deployment of preparation-only work.
- Separate independent ACL hardening proposals from blocked membership/caller replacements; missing live authorization evidence must not be concealed by a partial security PASS.