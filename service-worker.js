const STATIC_CACHE_NAME = "curconv-static-v5";
const API_CACHE_NAME = "curconv-api-v5";
const API_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const APP_SHELL_PATHS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./dist/app.js",
  "./dist/utils.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

const scopedUrl = (path) => new URL(path, self.registration.scope).toString();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_PATHS.map(scopedUrl)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) =>
                name !== STATIC_CACHE_NAME && name !== API_CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isCurrencyApi =
    url.hostname === "api.fxratesapi.com" ||
    url.hostname === "openexchangerates.org" ||
    url.hostname === "api.gold-api.com";

  if (isCurrencyApi) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match(scopedUrl("./index.html"))) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cachedResponse || (await networkPromise) || Response.error();
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response.ok) {
      const body = await response.clone().blob();
      const headers = new Headers(response.headers);
      headers.set("X-CurConv-Cached-At", String(Date.now()));

      await cache.put(
        request,
        new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        }),
      );
    }

    return response;
  } catch {
    const cachedResponse = await cache.match(request);
    if (!cachedResponse) return Response.error();

    const cachedAt = Number(
      cachedResponse.headers.get("X-CurConv-Cached-At") ?? 0,
    );

    return Date.now() - cachedAt <= API_MAX_AGE_MS
      ? cachedResponse
      : Response.error();
  }
}
