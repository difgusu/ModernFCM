// Service Worker per ModernFCM PWA (Scope: Radice '/')
const CACHE_NAME = 'modernfcm-pwa-v3';

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

self.addEventListener('fetch', (event) => {
  // Ignora richieste non GET o estensioni browser/schemi non HTTP
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  const url = new URL(event.request.url);

  // Non intercettare script PHP dinamici (invio formazione, live, calcolo)
  // Eccezione per endpoint di sola lettura utili alla PWA anche offline: preview.php
  const isCacheablePhp = url.pathname.endsWith('preview.php');
  if (url.pathname.endsWith('.php') && !isCacheablePhp) {
    return;
  }

  // Non memorizzare in cache richieste effimere con timestamp dinamico (?t=..., ?_=...)
  const isDynamicTimestamp = url.searchParams.has('t') || url.searchParams.has('_');

  // Risorse versionate con ?v=... o asset statici (font, immagini, audio)
  const isVersioned = url.searchParams.has('v') && !isDynamicTimestamp;
  const isStaticAsset = !isDynamicTimestamp && /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i.test(url.pathname);

  // Strategia 1: Cache-First per file versionati (?v=...) e asset statici
  // Risponde istantaneamente dalla cache se presente, evitando chiamate di rete ridondanti
  if (isVersioned || isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            }).catch(() => {});
          }
          return networkResponse;
        });
      }).catch(async () => {
        const fallback = await caches.match(event.request);
        if (fallback) return fallback;
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      })
    );
    return;
  }

  // Strategia 2: Network-First per JSON dati, pagine HTML e risposte non versionate
  // Prova prima la rete per avere dati sempre aggiornati; fallback su cache se offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (!isDynamicTimestamp && networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          }).catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response('', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});
