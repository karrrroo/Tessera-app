// Minimal, hand-rolled precache for the /id route shell only (roadmap Phase
// 6, ID-8: "the /id route shell and its assets are precached in this phase
// because ID-8 is a Phase 6 acceptance criterion and cannot be deferred").
// Phase 13 owns the real service worker and should replace this file
// entirely rather than extend it — this one deliberately knows nothing
// about any other route.
//
// Strategy: cache-as-you-go, not a build-time precache list, because Next's
// App Router serves content-hashed chunk filenames this file has no way to
// know ahead of time. The first time /id (and the /_next/static chunks it
// needs) load successfully online, they're cached; a later offline
// navigation to /id is served from that cache. /api/* is never touched
// here — credential data freshness is IndexedDB's job (useCredential), not
// this file's.
const SHELL_CACHE = "tessera-id-shell-v1";
const SHELL_PATH = "/id";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isShellAsset = url.pathname === SHELL_PATH || url.pathname.startsWith("/_next/static/");
  if (!isShellAsset) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(SHELL_CACHE);
          event.waitUntil(cache.put(request, response.clone()));
        }
        return response;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});
