// Service worker mínimo: la app abre sin cobertura (en el súper). La API (/v1) nunca se cachea aquí:
// los datos sin red los guarda la propia app en localStorage (src/sync.js).
const CACHE = 'compra-v4';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/v1/')) return;
  // Páginas: red primero (para tener siempre la última versión), caché si no hay red
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return r; })
      .catch(() => caches.match('/')));
    return;
  }
  // assets/ (nombre con hash), iconos: caché primero
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  })));
});
