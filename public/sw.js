// v4(2026-10-03): 도트 적 그림이 같은 주소에서 바뀌었고 옛 전투 그림을 deprecated/ 로 옮겼다 — 옛 캐시를 비운다.
const CACHE_NAME = "oprn-pwa-v4";
const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/pwa-192.png",
  "/icons/pwa-512.png",
];
const CACHE_FIRST_DESTINATIONS = new Set(["font", "image", "manifest", "script", "style", "worker"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(cacheNames.filter((cacheName) => cacheName !== CACHE_NAME).map((cacheName) => caches.delete(cacheName))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!shouldHandle(event.request)) return;
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }
  if (shouldCacheFirst(event.request)) {
    event.respondWith(cacheFirst(event.request));
  }
});

function shouldHandle(request) {
  const url = new URL(request.url);
  // The network owns byte ranges (including 206/416). Cache API keys ignore Range
  // and cache.put rejects 206, so neither lookup nor insertion is safe here.
  return request.method === "GET" && !request.headers.has("range") && url.origin === self.location.origin;
}

function shouldCacheFirst(request) {
  const url = new URL(request.url);
  return CACHE_FIRST_DESTINATIONS.has(request.destination) || url.pathname.startsWith("/assets/");
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.status === 200) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request)) ?? (await cache.match("/index.html")) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}
