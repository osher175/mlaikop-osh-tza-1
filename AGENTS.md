# Architecture rules

- Keep home-screen support manifest-only, without an app-shell service worker, unless offline use is explicitly requested; this avoids stale preview caches.
- Derive install icons from the existing favicon as full-bleed squares served as real files (/apple-touch-icon.png, /icons/*); iOS requests that root path directly.