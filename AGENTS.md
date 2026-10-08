# Architecture rules

- Keep home-screen support manifest-only, without an app-shell service worker, unless offline use is explicitly requested; this avoids stale preview caches.
- Derive install icons from the existing favicon; serve the Apple touch icon as a real file at /apple-touch-icon.png (iOS requests that root path directly), while manifest icons may use asset-pointer URLs.