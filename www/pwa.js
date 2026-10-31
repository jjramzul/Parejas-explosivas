'use strict';
/* PWA: registra el service worker y ofrece "Instalar app" (Android/Chrome) o la guía de iPhone. */
(() => {
  if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) return;   // en la app nativa no hay service worker ni "Instalar"
  const btn = document.getElementById('install');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  let ev = null;

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  if (!btn || standalone) return;

  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ev = e; btn.hidden = false; });
  addEventListener('appinstalled', () => { ev = null; btn.hidden = true; });
  if (ios) btn.hidden = false;                    // Safari no avisa: mostramos la guía

  btn.onclick = async () => {
    if (ev) { ev.prompt(); await ev.userChoice.catch(() => {}); ev = null; btn.hidden = true; return; }
    if (ios) openSheet(`<h2>Instalar en iPhone</h2><p class="rules">Toca <b>Compartir</b> en Safari y elige <b>Agregar a inicio</b>. Se abrirá a pantalla completa, como una app.</p>
      <div class="acts" style="margin-top:18px"><button class="btn" data-act="close">Entendido</button></div>`);
  };
})();
