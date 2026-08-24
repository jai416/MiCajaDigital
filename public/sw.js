// La versión de la caché viene por query al registrar el SW
// (?v=NEXT_PUBLIC_APP_VERSION desde RegisterSW): cada release con versión
// nueva crea una caché nueva y borra las viejas en activate, así el panel no
// se queda pegado a JS/CSS de un deploy anterior.
const VERSION = new URLSearchParams(self.location.search).get('v') || 'dev';
const CACHE = `mcd-admin-v1-${VERSION}`;
const SHELL = ['/', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // NADA de /dashboard se cachea (ni HTML ni assets RSC): es la zona
  // autenticada. Cachear su shell dejaría ver el panel con datos viejos tras
  // cerrar sesión o cambiar de cuenta en modo offline. El fallback offline de
  // navegaciones solo aplica fuera del dashboard (login).
  if (url.pathname.startsWith('/dashboard') || request.headers.has('RSC')) {
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Assets: stale-while-revalidate. Sirve del caché para ser instantáneo pero
  // refresca en segundo plano; al cambiar VERSION, la caché vieja se descarta.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
