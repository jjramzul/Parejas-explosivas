'use strict';
/* ====================== Tutorial guiado ======================
   Se abre desde el botón (i) de la partida → "¿Cómo se juega? Ver tutorial".
   Ilumina partes reales de la pantalla (tablero, marcador, poderes y, en línea, el reloj)
   con una explicación corta. Contra la máquina, la máquina espera mientras está abierto. */
const Tutorial = (() => {
  let root = null, spot = null, tip = null, steps = [], i = 0, lastFocus = null;

  function buildSteps(G) {
    const names = (G && G.pool || []).map(p => POWERS[p].name);
    const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1] : names.join('');
    const s = [
      { el: '#board', title: 'Encuentra las parejas',
        text: 'Voltea 2 cartas por turno. Si son iguales, la pareja es tuya y vuelves a jugar. Si no, se voltean de nuevo y le toca al otro.' },
      { el: '#scores', title: 'Marcador',
        text: 'Gana quien tenga más parejas al final. Los íconos pequeños son los poderes de cada jugador; en gris, ya se usaron.' },
      { el: '.dock', title: 'Poderes',
        text: `Úsalos al inicio de tu turno, antes de voltear. Cada jugador usa cada poder una sola vez.${list ? ` En esta partida: ${list}.` : ''}` }
    ];
    if (G && G.online) s.push({ el: '#status', title: 'Tiempo por jugada',
      text: `Tienes ${Online.turnSeconds} segundos para elegir cada pareja; si se acaba, pierdes el turno. Barajar también sirve en el turno de tu rival, antes de que voltee.` });
    return s;
  }

  function start(G) {
    if (root || !G) return;
    steps = buildSteps(G); i = 0; lastFocus = document.activeElement;
    root = document.createElement('div');
    root.className = 'tut'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'tutTitle');
    root.innerHTML = `<div class="tut-spot" aria-hidden="true"></div>
      <div class="tut-tip">
        <p class="tut-step" id="tutStep"></p>
        <h3 id="tutTitle"></h3>
        <p class="tut-text" id="tutText"></p>
        <div class="tut-nav">
          <button type="button" class="tut-skip">Saltar</button>
          <span class="tut-dots" aria-hidden="true"></span>
          <button type="button" class="tut-back">Atrás</button>
          <button type="button" class="btn tut-next">Siguiente</button>
        </div>
      </div>`;
    document.body.appendChild(root); document.body.classList.add('tutorial');
    spot = root.querySelector('.tut-spot'); tip = root.querySelector('.tut-tip');
    root.querySelector('.tut-dots').innerHTML = steps.map(() => '<i></i>').join('');
    root.querySelector('.tut-skip').onclick = close;
    root.querySelector('.tut-back').onclick = () => go(i - 1);
    root.querySelector('.tut-next').onclick = () => i < steps.length - 1 ? go(i + 1) : close();
    document.addEventListener('keydown', onKey);
    addEventListener('resize', place);
    go(0, true);
    requestAnimationFrame(() => root && root.classList.add('show'));
  }

  function go(n, first) {
    if (!root || n < 0 || n >= steps.length) return;
    i = n;
    const st = steps[i], last = i === steps.length - 1;
    root.querySelector('#tutStep').textContent = `Paso ${i + 1} de ${steps.length}`;
    root.querySelector('#tutTitle').textContent = st.title;
    root.querySelector('#tutText').textContent = st.text;
    root.querySelector('.tut-back').hidden = i === 0;
    root.querySelector('.tut-next').textContent = last ? 'Entendido' : 'Siguiente';
    root.querySelectorAll('.tut-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    if (!first) Sfx.play('tap');
    place();
    root.querySelector('.tut-next').focus({ preventScroll: true });
  }

  /* Ubica el foco de luz sobre el elemento y la tarjeta arriba o abajo, sin salirse de la pantalla */
  function place() {
    if (!root) return;
    const el = document.querySelector(steps[i].el);
    const vw = innerWidth, vh = innerHeight, m = 16, pad = 8;
    let r = el ? el.getBoundingClientRect() : { left: vw / 2, top: vh / 2, width: 0, height: 0, right: vw / 2, bottom: vh / 2 };
    const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
    const w = Math.min(vw - x - 4, r.width + pad * 2), h = Math.min(vh - y - 4, r.height + pad * 2);
    Object.assign(spot.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const tw = Math.min(340, vw - m * 2);
    tip.style.width = tw + 'px';
    const th = tip.offsetHeight || 190;
    let ty;
    if (vh - (y + h) >= th + m * 2) ty = y + h + m;            // debajo
    else if (y >= th + m * 2) ty = y - th - m;                  // encima
    else ty = Math.min(y + h - th - m, vh - th - m);          // no cabe: sobre el propio elemento, pegada abajo
    ty = Math.max(m, ty);
    const tx = Math.min(Math.max(m, x + w / 2 - tw / 2), vw - tw - m);
    Object.assign(tip.style, { left: tx + 'px', top: ty + 'px' });
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
  }

  function close() {
    if (!root) return;
    const r = root; root = null; document.body.classList.remove('tutorial');
    document.removeEventListener('keydown', onKey);
    removeEventListener('resize', place);
    r.classList.remove('show');
    setTimeout(() => r.remove(), 250);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  return { start, close, get open() { return !!root; } };
})();