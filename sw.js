'use strict';
/* Service worker: el juego abre sin conexión (local y contra la máquina).
   Sube VERSION cada vez que cambies archivos para que los celulares se actualicen. */
const VERSION = 'pcp-v1';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'audio.js', 'online.js', 'tutorial.js', 'firebase-config.js',
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
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (r.mode === 'navigate' ? c.match('index.html') : Response.error());
  }));
});