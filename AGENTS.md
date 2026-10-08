# Architecture rules

- Keep home-screen support manifest-only, without an app-shell service worker, unless offline use is explicitly requested; this avoids stale preview caches.
- Derive install icons from the existing brand asset and use asset-pointer URLs in the HTML head and manifest; this preserves branding while keeping binary copies outside the repository.