'use strict';
/* ====================== Tutorial (pantalla de inicio) ======================
   Botón "¿Cómo se juega?" en el menú → hoja con páginas: objetivo, turno, poderes (los 10) y en línea. */
const Tutorial = (() => {
  let i = 0, open = false;
  const th = () => THEMES.find(t => t.id === cfg.theme) || THEMES[0];
  const card = (idx, up = true) => `<span class="tcard${up ? ' up' : ''}">${up ? svgOf(th().icons[idx]) : '<i></i>'}</span>`;

  const pages = () => [
    { t: 'Encuentra las parejas', p: 'Gana quien consiga más parejas al final. Cada pareja es de quien la encuentra.',
      art: `<div class="tart">${card(0)}${card(0)}${card(4, false)}${card(7, false)}</div>` },
    { t: 'Tu turno', p: 'Voltea 2 cartas. Si son iguales, la pareja es tuya y vuelves a jugar. Si no, se cierran y le toca al siguiente.',
      art: `<div class="tart">${card(2)}${card(5)}<span class="tarrow">→</span>${card(2, false)}${card(5, false)}</div>` },
    { t: 'Poderes', p: 'Cada partida trae 3 poderes, sorteados o elegidos. Cada jugador usa cada uno una sola vez, al inicio de su turno.',
      art: `<div class="tart pw">${PIDS.map(id => `<span class="tpi" title="${POWERS[id].name}">${pIcon(POWERS[id].icon)}</span>`).join('')}</div>` },
    { t: 'Los 10 poderes', p: '', list: true },
    { t: 'En línea', p: 'Crea una sala y comparte el código o el QR: juegan hasta 4. Tienes 15 segundos por jugada; si se acaban, pierdes el turno. Algunos poderes (Escudo, Barajar, Intercambio, Congelar, Cuarentena) también valen en el turno de otro.',
      art: `<div class="tart">${card(1)}${card(3)}${card(6)}${card(8)}</div>` }
  ];

  function render() {
    const ps = pages(), pg = ps[i], last = i === ps.length - 1;
    const body = pg.list
      ? `<div class="plist tlist">${PIDS.map(id => `<div class="prow"><span class="pi">${pIcon(POWERS[id].icon)}</span><span class="pt"><b>${POWERS[id].name}</b><small>${POWERS[id].desc}</small></span></div>`).join('')}</div>`
      : `<div class="tartw">${pg.art}</div><p class="rules tp">${pg.p}</p>`;
    sheet.innerHTML = `<p class="tstep">${i + 1} de ${ps.length}</p><h2 class="tt">${pg.t}</h2>${body}
      <div class="tnav"><span class="tdots" aria-hidden="true">${ps.map((_, k) => `<i${k === i ? ' class="on"' : ''}></i>`).join('')}</span>
        ${i ? '<button type="button" class="btn sec tb">Atrás</button>' : ''}<button type="button" class="btn tn">${last ? 'Entendido' : 'Siguiente'}</button></div>`;
    const b = sheet.querySelector('.tb'); if (b) b.onclick = () => go(i - 1);
    sheet.querySelector('.tn').onclick = () => last ? close() : go(i + 1);
    sheet.scrollTop = 0;
  }
  function go(n) { i = n; Sfx.play('tap'); render(); }
  function close() { open = false; closeSheet(); }
  function start() { i = 0; open = true; openSheet('', false); render(); setTimeout(() => { const n = sheet.querySelector('.tn'); n && n.focus({ preventScroll: true }); }, 80); }
  scrim.addEventListener('click', ev => { if (open && ev.target === scrim) open = false; });

  /* ---------- Bienvenida a pantalla completa (solo apps nativas, solo la primera vez) ---------- */
  const OB_KEY = 'pcp-onboarded';
  let ob = null, oi = 0;
  const obPages = () => [{ t: 'Bienvenido a Boom Duo', p: 'Encuentra las parejas y usa tus poderes en el momento justo.',
      art: `<div class="tart">${card(0)}${card(5)}${card(7)}</div>`, hero: true }].concat(pages());
  function obRender() {
    const ps = obPages(), pg = ps[oi], last = oi === ps.length - 1;
    const body = pg.list
      ? `<h2 class="tt">${pg.t}</h2><div class="plist tlist">${PIDS.map(id => `<div class="prow"><span class="pi">${pIcon(POWERS[id].icon)}</span><span class="pt"><b>${POWERS[id].name}</b><small>${POWERS[id].desc}</small></span></div>`).join('')}</div>`
      : `<div class="tartw">${pg.art}</div><h2 class="tt">${pg.t}</h2><p class="rules tp">${pg.p}</p>`;
    ob.innerHTML = `<div class="onbtop"><span></span>${last ? '<span></span>' : '<button type="button" class="onbskip">Saltar</button>'}</div>
      <div class="onbbody"><div class="onbpage" key="${oi}">${body}</div></div>
      <div class="onbnav"><span class="tdots" aria-hidden="true">${ps.map((_, k) => `<i${k === oi ? ' class="on"' : ''}></i>`).join('')}</span>
        <div class="onbbtns">${oi ? '<button type="button" class="btn sec onbback">Atrás</button>' : ''}<button type="button" class="btn onbnext">${last ? '¡A jugar!' : 'Siguiente'}</button></div></div>`;
    const s = ob.querySelector('.onbskip'); if (s) s.onclick = obClose;
    const b = ob.querySelector('.onbback'); if (b) b.onclick = () => { oi--; Sfx.play('tap'); obRender(); };
    ob.querySelector('.onbnext').onclick = () => { if (last) obClose(); else { oi++; Sfx.play('tap'); obRender(); } };
  }
  function obClose() { if (!ob) return; const el = ob; ob = null; el.classList.add('out'); setTimeout(() => el.remove(), 350); Sfx.play('tap'); }
  function onboard() {
    try { if (localStorage.getItem(OB_KEY)) return; localStorage.setItem(OB_KEY, '1'); } catch (e) { return; }   // se marca al empezar: solo se ve una vez
    oi = 0; ob = document.createElement('div'); ob.className = 'onb'; ob.setAttribute('role', 'dialog'); ob.setAttribute('aria-modal', 'true'); ob.setAttribute('aria-label', 'Bienvenida');
    document.body.appendChild(ob); obRender();
  }
  if (NATIVE) onboard();                                  // la web no muestra bienvenida
  return { start, close, onboard, get open() { return open; } };
})();
