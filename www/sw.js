'use strict';
/* Service worker: el juego abre sin conexión (local y contra la máquina).
   Sube VERSION cada vez que cambies archivos para que los celulares se actualicen. */
const VERSION = 'pcp-v40';
const FILES = ['./', 'index.html', 'styles.css', 'i18n.js', 'app.js', 'audio.js', 'online.js', 'tutorial.js', 'pwa.js', 'firebase-config.js',
  'vendor/qrcode.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Archivos propios: primero caché y se actualiza en segundo plano. Firebase y demás sitios van directo a la red. */
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  /* Páginas (navegación): red primero; sin conexión, el index.html guardado. Nunca devuelve otro archivo. */
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => {
      if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) { const cp = res.clone(); caches.open(VERSION).then(c => c.put('index.html', cp)); }
      return res;
    }).catch(() => caches.open(VERSION).then(c => c.match('index.html'))));
    return;
  }
  /* Resto de archivos propios: caché y se actualiza en segundo plano. */
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  }));
});
