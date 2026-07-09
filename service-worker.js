const CACHE_NAME = "curconv-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/dist/app.js",
  "/assets/icon.png",
];

const API_CACHE_NAME = "curconv-api-v1";

// Install: cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
            .map((key) => caches.delete(key)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Fetch: smart routing
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network-first, fallback to cache (24h max)
  if (
    url.hostname.includes("fxratesapi.com") ||
    url.hostname.includes("openexchangerates.org")
  ) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Static assets: cache-first, background revalidate
  event.respondWith(cacheFirstWithRevalidate(request));
});

async function cacheFirstWithRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

async function networkFirstWithCache(request) {
  const cache = await caches.open(API_CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const clone = networkResponse.clone();
      const headers = new Headers(clone.headers);
      headers.set("X-SW-Cached-At", Date.now().toString());
      const cachedResponse = new Response(await clone.blob(), {
        status: clone.status,
        statusText: clone.statusText,
        headers,
      });
      await cache.put(request, cachedResponse);
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      const age =
        Date.now() - parseInt(cached.headers.get("X-SW-Cached-At") || "0");
      if (age < 24 * 60 * 60 * 1000) return cached;
    }
    throw new Error("Offline and no cached rates available");
  }
}
