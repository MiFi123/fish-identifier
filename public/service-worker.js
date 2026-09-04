const CACHE_NAME = "fish-identifier-shell-v11";
const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/catch-store.js",
  "/catch-statistics.js",
  "/catch-backup.js",
  "/local-backup-store.js",
  "/water-store.js",
  "/manifest.webmanifest",
  "/icons/favicon.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith("fish-identifier-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Reine, öffentliche Arten-Metadaten dürfen für das Offline-Lexikon gecacht werden.
  if (url.pathname === "/api/species" && request.method === "GET") {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }
  // Analyse-, Entwicklungs- und Bildanfragen werden nie im Cache gespeichert.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && APP_SHELL.includes(url.pathname)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
