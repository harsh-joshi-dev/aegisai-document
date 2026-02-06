/* Minimal service worker for mobile web offline support.
   - App shell caching
   - Network-first for API, fallback to cache
   - Stale-while-revalidate for static assets
*/

const CACHE_VERSION = "aegis-web-mobile-v1";
const APP_SHELL = [
  "/",
  "/m",
  "/index.html",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_VERSION ? Promise.resolve() : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

function isApiRequest(request) {
  try {
    const url = new URL(request.url);
    return url.pathname.startsWith("/api");
  } catch {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== "GET") return;

  // API: network-first with better error handling
  if (isApiRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          // Only cache successful responses
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch((error) => {
          // Silently fall back to cache, don't log connection errors
          return caches.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            // Return a proper error response instead of failing silently
            return new Response(
              JSON.stringify({ 
                error: 'Network error', 
                message: 'Unable to reach server. Please check your connection.' 
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Static: cache-first + update in background
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

