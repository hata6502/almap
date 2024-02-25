const almapRequests = [
  "./",
  "./favicon.png",
  "./index.css",
  "./index.js",
  "./manifest.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
];
const almapCacheName = `almap-${process.env.TIMESTAMP}`;
const serviceWorker = globalThis as unknown as ServiceWorkerGlobalScope;

serviceWorker.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(async (key) => {
          if ([almapCacheName, "openstreetmap"].includes(key)) {
            return;
          }
          await caches.delete(key);
        })
      );

      await serviceWorker.clients.claim();
    })()
  );
});

serviceWorker.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      const isOpenStreetMapRequest = [
        "https://nominatim.openstreetmap.org/",
        "https://tile.openstreetmap.jp/",
      ].some((openStreetMapURL) =>
        event.request.url.startsWith(openStreetMapURL)
      );

      const cacheResponse = await caches.match(event.request);
      if (cacheResponse) {
        return cacheResponse;
      }

      const fetchResponse = await fetch(event.request);
      if (isOpenStreetMapRequest && fetchResponse.ok) {
        const openStreetMapCache = await caches.open("openstreetmap");
        await openStreetMapCache.put(event.request, fetchResponse.clone());
      }
      return fetchResponse;
    })()
  );
});

serviceWorker.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const almapCache = await caches.open(almapCacheName);
      await almapCache.addAll(almapRequests);
      await serviceWorker.skipWaiting();
    })()
  );
});
