// Service Worker per ModernFCM PWA (Scope: Radice '/')
const CACHE_NAME = 'modernfcm-pwa-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Strategia Network-First con fallback sicuro
self.addEventListener('fetch', (event) => {
  // Ignora richieste non GET o estensioni browser/schemi non HTTP
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Non intercettare script PHP dinamici (invio formazione, live, calcolo)
  // Eccezione per endpoint di sola lettura utili alla PWA anche offline: preview.php
  const url = new URL(event.request.url);
  const isCacheablePhp = url.pathname.endsWith('preview.php');
  if (url.pathname.endsWith('.php') && !isCacheablePhp) {
    return;
  }

  // Non memorizzare in cache richieste effimere con timestamp dinamico (?t=..., ?_=...)
  // per prevenire la crescita incontrollata (cache leak) dello storage
  const isDynamicTimestamp = url.searchParams.has('t') || url.searchParams.has('_');

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se la risposta è valida e statica, aggiorna la cache per le risorse della stessa origine
        if (!isDynamicTimestamp && networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          }).catch(() => { });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Fallback su cache in caso di errore di rete / offline
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Se non è presente in cache e la rete fallisce, restituisci sempre una Response valida
        // evitando il crash "TypeError: Failed to convert value to 'Response'"
        return new Response('', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});
