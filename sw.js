/* Service worker: makes the app work offline. Network first, cache fallback, so updates arrive when online. */
const V = 'printpress-online-v5';
const FILES = ['./', 'index.html', 'css/style.css', 'js/backend.js', 'js/app.js', 'js/hr.js', 'js/extras.js', 'js/online.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(FILES).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;            // never cache Supabase API / files
  if (u.pathname.endsWith('/config.js')) return;             // connection settings are always read fresh from the server
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(V).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
