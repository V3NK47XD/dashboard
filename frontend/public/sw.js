/**
 * Personal Dashboard PWA Service Worker
 * Offline-first asset caching with passthrough for npoint.io API synchronization.
 * Supports root and subdirectory deployments (e.g. GitHub Pages).
 */

const CACHE_NAME = 'personal-os-v2';
const BASE = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);

const ASSETS_TO_CACHE = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.webmanifest`,
  `${BASE}favicon.svg`,
  `${BASE}icon-192.svg`,
  `${BASE}icon-512.svg`,
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Cache shell assets
      await cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Pre-caching error (non-fatal):', err);
      });

      // 2. Fetch and parse index.html to precache JS and CSS bundles immediately for 100% offline access
      try {
        const resp = await fetch(`${BASE}index.html`);
        if (resp && resp.status === 200) {
          const html = await resp.text();
          const matches = html.match(/(?:src|href)="([^"]+\.(?:js|css))"/g) || [];
          const bundleUrls = matches.map((m) => {
            const raw = m.replace(/^(?:src|href)="/, '').replace(/"$/, '');
            return new URL(raw, self.location.href).href;
          });
          if (bundleUrls.length > 0) {
            await Promise.all(
              bundleUrls.map(async (bundleUrl) => {
                try {
                  const bResp = await fetch(bundleUrl);
                  if (bResp && bResp.status === 200) {
                    await cache.put(bundleUrl, bResp);
                  }
                } catch (e) {
                  console.warn('[SW] Bundle asset cache failed:', bundleUrl, e);
                }
              })
            );
          }
        }
      } catch (err) {
        console.warn('[SW] Dynamic bundle discovery failed:', err);
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache npoint.io or external API calls
  if (url.hostname.includes('npoint.io') || event.request.method !== 'GET') {
    return;
  }

  // Handle SPA navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match(`${BASE}index.html`)) ||
          (await cache.match(BASE)) ||
          (await cache.match('/index.html')) ||
          (await cache.match('/'))
        );
      })
    );
    return;
  }

  // Stale-while-revalidate for local static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
