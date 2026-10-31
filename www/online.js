'use strict';
/* ====================== Modo en línea (Firebase Realtime Database) · hasta 4 jugadores ======================
   Una sala vive en rooms/CODIGO:
   {
     host,                                         // uid del creador (siempre asiento 0)
     members: { uid: asiento },                    // quién ocupa cada asiento (0..3)
     config:  { size, theme, pool },               // lo que eligió el creador
     players: { p0: { online, name }, ... },       // presencia (onDisconnect) y nombre corto
     game: {
       n, round, status: 'waiting' | 'playing' | 'over',   // 'waiting' = sala de espera, el creador inicia
       deck, owner (-1 | asiento), open, openedAt, turn, scores[n], used{pN:{poder:true}},
       frozen[n], shield[n], quar[], short[n], last[n], lastAt[n], turnAt,
       ev: { id, kind, by, pid, eff, victim, cells }  // último evento, para avisos en todas las pantallas
     }
   }
   Toda jugada se escribe con una transacción, así dos toques al mismo tiempo no rompen el estado.
   Al empezar, el creador compacta los asientos (se van los desconectados) y reparte los turnos por asiento.
   Visión e Imán solo se muestran en la pantalla de quien los usa.
   Cada jugada tiene TURN_MS; si se acaba, el turno pasa al siguiente jugador conectado. */
const Online = (() => {
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin 0, O, 1 ni I
  const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
  const MAXP = 4, NAME_MAX = 8;
  let fb = null, uid = null;                          // backend y usuario anónimo
  let code = null, seat = -1, room = null, G = null;  // sala actual, mi asiento (0 = creador)
  let unsub = [], lastEv = 0, timer = null, timerKey = '', presWas = [];
  const TURN_MS = window.PCP_TURN_MS || 15000;        // tiempo máximo por jugada
  let clockTimer = null, clockKey = '', ticker = null, warned = '', prev = null, lastTick = null;

  /* ---------- Firebase: se carga solo cuando se usa el modo en línea ---------- */
  const loadScript = src => new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => ko(new Error('No se pudo cargar Firebase. Revisa tu conexión.'));
    document.head.appendChild(s);
  });
  const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(new Error(msg)), ms))]);

  async function ensureFB() {
    if (fb) return fb;
    if (window.FB) return (fb = window.FB);           // backend inyectado (pruebas automáticas)
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}/`;
    await loadScript(base + 'firebase-app-compat.js');
    await Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-database-compat.js')]);
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
    const auth = app.auth(), db = app.database(), ref = p => db.ref(p);
    let offset = 0;                                   // diferencia entre este reloj y el del servidor
    ref('.info/serverTimeOffset').on('value', s => { offset = s.val() || 0; });
    fb = {
      now: () => Date.now() + offset,
      async signIn() {
        // Sesión por pestaña: dos pestañas = dos jugadores distintos, y recargar no te saca de la sala
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        await new Promise(res => { const off = auth.onAuthStateChanged(() => { off(); res(); }); });
        if (!auth.currentUser) await auth.signInAnonymously();
        return auth.currentUser.uid;
      },
      get: async p => (await ref(p).get()).val(),
      set: (p, v) => ref(p).set(v),
      remove: p => ref(p).remove(),
      async tx(p, fn) {
        const r = await ref(p).transaction(fn, undefined, false);
        return { committed: r.committed, value: r.snapshot.val() };
      },
      on(p, cb) { const h = s => cb(s.val()); ref(p).on('value', h); return () => ref(p).off('value', h); },
      onDisconnectSet: (p, v) => ref(p).onDisconnect().set(v),
      cancelOnDisconnect: p => ref(p).onDisconnect().cancel()
    };
    return fb;
  }
  const OFFLINE = 'Sin conexión: intenta de nuevo';
  const net = p => withTimeout(p, 12000, OFFLINE);       // sin red, Firebase se queda esperando: aquí se corta con un aviso claro
  async function connect() {
    if (navigator.onLine === false) throw new Error(OFFLINE);
    await withTimeout(ensureFB(), 12000, OFFLINE);
    if (!uid) uid = await withTimeout(fb.signIn(), 12000, OFFLINE);
  }
  const gp = () => `rooms/${code}/game`;
  const quiet = p => { if (p && p.catch) p.catch(() => {}); };

  /* ---------- Estado de la partida ---------- */
  const fill = (a, n, d) => Array.from({ length: n }, (_, i) => (a && a[i] != null) ? a[i] : d);
  function norm(g) {                                   // Firebase borra arrays/objetos vacíos: se reconstruyen
    g = g || {};
    const n = g.n || 2, len = g.deck ? g.deck.length : 0, used = {};
    for (let i = 0; i < n; i++) used['p' + i] = { ...(g.used && g.used['p' + i]) };
    return {
      n, round: g.round || 1, status: g.status || 'waiting',
      deck: fill(g.deck, len, 0), owner: fill(g.owner, len, -1),
      open: g.open ? Object.values(g.open) : [], openedAt: g.openedAt || 0,
      turn: g.turn || 0, scores: fill(g.scores, n, 0), used,
      frozen: fill(g.frozen, n, false), shield: fill(g.shield, n, false),
      quar: fill(g.quar, len, -1), short: fill(g.short, n, false), last: fill(g.last, n, 0), lastAt: fill(g.lastAt, n, 0),
      turnAt: g.turnAt || 0, ev: g.ev || null
    };
  }
  function newGame(config, round, evId, n) {
    const th = THEMES.find(t => t.id === config.theme) || THEMES[0], z = SIZES[config.size] || SIZES['16'];
    const syms = shuf([...Array(th.icons.length).keys()]).slice(0, z.pairs);
    const deck = shuf([...syms, ...syms]), f = v => Array.from({ length: n }, () => v);
    return {
      n, round, status: 'playing', deck, owner: deck.map(() => -1), turn: (round - 1) % n,
      scores: f(0), frozen: f(false), shield: f(false), turnAt: fb.now(),
      quar: deck.map(() => -1), short: f(false), last: f(0), lastAt: f(0),
      ev: { id: (evId || 0) + 1, kind: 'round', by: 0 }
    };
  }
  const genCode = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), n => ALPHA[n % ALPHA.length]).join('');

  /* ---------- Nombres cortos ---------- */
  const cleanName = s => String(s == null ? '' : s).replace(/[<>&"'`\\\\\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  const defName = i => 'Jugador ' + (i + 1);
  function namesOf(r, n) {                             // nombres a mostrar; si dos se repiten, el segundo lleva un número
    const seen = {};
    return Array.from({ length: n }, (_, i) => {
      const p = r && r.players && r.players['p' + i], raw = String((p && p.name) || ''), base = raw === defName(i) ? raw : (cleanName(raw) || defName(i)), k = base.toLowerCase();
      seen[k] = (seen[k] || 0) + 1;
      return seen[k] > 1 ? base.slice(0, NAME_MAX - 2) + ' ' + seen[k] : base;
    });
  }
  const isOff = (r, i) => !!(r && r.players && r.players['p' + i] && r.players['p' + i].online === false);
  const memberCount = r => Object.keys((r && r.members) || {}).length;

  /* ---------- Crear sala ---------- */
  async function create() {
    showLobby('busy', 'Creando sala…');
    try {
      await connect();
      const pool = cfg.powerMode === 'random' ? shuf(PIDS).slice(0, 3) : PIDS.filter(p => cfg.picked.includes(p));
      const config = { size: cfg.size, theme: cfg.theme, pool, auto: false };   // se respeta el tablero que eligió el creador (puede cambiarlo en la sala de espera)
      for (let i = 0; i < 5 && !code; i++) {
        const c = genCode();
        const r = await net(fb.tx('rooms/' + c, cur => cur === null ? {
          host: uid, createdAt: Date.now(), config, members: { [uid]: 0 },
          players: { p0: { online: true, name: cleanName(cfg.name) || defName(0) } },
          game: { round: 1, status: 'waiting', n: 2, ev: { id: 0, kind: 'round', by: 0 } }
        } : undefined));
        if (r.committed) { code = c; seat = 0; }
      }
      if (!code) throw new Error('No se pudo crear la sala. Intenta de nuevo.');
      await enterRoom();
      showRoom();
    } catch (e) { fail(e); }
  }

  /* ---------- Unirse ---------- */
  function openJoin() {
    showLobby('join');
    const inp = $('#codeInput'); inp.value = ''; $('#joinErr').textContent = '';
    setTimeout(() => inp.focus(), 50);
  }
  async function join(raw) {
    const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!CODE_RE.test(c)) { openJoin(); $('#codeInput').value = c; $('#joinErr').textContent = 'El código tiene 6 caracteres (sin 0, O, 1 ni I).'; return; }
    showLobby('busy', 'Uniéndote a la sala…');
    try {
      await connect();
      const r = await net(fb.get('rooms/' + c));
      if (!r) throw new Error('No existe una sala con ese código.');
      const mine = r.members && r.members[uid];
      if (mine != null) seat = mine;                   // volver a mi lugar (recargué la página)
      else {
        if (!r.game || r.game.status !== 'waiting') throw new Error('La partida ya empezó.');
        const res = await net(fb.tx('rooms/' + c, cur => {
          if (!cur) return cur;
          if (!cur.game || cur.game.status !== 'waiting') return;
          cur.members = cur.members || {}; cur.players = cur.players || {};
          if (cur.members[uid] != null) return cur;
          const taken = new Set(Object.values(cur.members));
          let s = -1;
          for (let k = 0; k < MAXP && s < 0; k++) if (!taken.has(k)) s = k;
          if (s < 0) {                                  // sala llena: se libera el lugar de alguien que ya se desconectó
            for (const [u, k] of Object.entries(cur.members)) {
              const p = cur.players['p' + k];
              if (u !== cur.host && p && p.online === false) { delete cur.members[u]; s = k; break; }
            }
          }
          if (s < 0) return;
          cur.members[uid] = s;
          cur.players['p' + s] = { online: true, name: cleanName(cfg.name) || defName(s) };
          return cur;
        }));
        const m = res.value && res.value.members && res.value.members[uid];
        if (!res.value) throw new Error('No existe una sala con ese código.');
        if (m == null) throw new Error(res.value.game && res.value.game.status !== 'waiting' ? 'La partida ya empezó.' : 'Esa sala ya está llena.');
        seat = m;
      }
      code = c;
      await enterRoom();
    } catch (e) {
      seat = -1; code = null;
      openJoin(); $('#codeInput').value = c; $('#joinErr').textContent = e.message || 'No se pudo unir a la sala.';
    }
  }

  let presPath = '';
  function bindPresence() {                            // mi "en línea" sigue a mi asiento (cambia cuando se compactan los asientos)
    const p = `rooms/${code}/players/p${seat}/online`;
    if (presPath === p) return;
    if (presPath) quiet(fb.cancelOnDisconnect(presPath));
    presPath = p;
    quiet(fb.set(p, true));
    quiet(fb.onDisconnectSet(p, false));
  }
  async function enterRoom() {
    presPath = ''; bindPresence();
    try { history.replaceState(null, '', location.pathname + '?sala=' + code); } catch (e) {}
    lastEv = 0; presWas = [];
    unsub.push(fb.on('rooms/' + code, onRoom));
    // Si el celular pierde la conexión (por ejemplo al cambiar de app para copiar el código), Firebase te marca desconectado.
    // Al volver hay que reafirmar "en línea" y volver a registrar la desconexión, o te quedas como desconectado para siempre.
    unsub.push(fb.on('.info/connected', v => {
      if (v === true && presPath && code) { quiet(fb.set(presPath, true)); quiet(fb.onDisconnectSet(presPath, false)); }
      if (G && (v === true || v === false) && G.offline !== (v === false)) { G.offline = v === false; if (!G.offline) toast('Conexión recuperada'); sync(); }
    }));
  }

  /* ====================== Reacciones rápidas ====================== */
  const S_ = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const REACTS = [
    { k: 'bien',   t: '¡Bien!',  svg: `<svg ${S_}><path d="M7 11v9H4v-9h3Z"/><path d="m7 11 4-7c1.6 0 2.6 1.1 2.3 2.7L12.7 10H18a2 2 0 0 1 2 2.3l-1 6a2 2 0 0 1-2 1.7H7"/></svg>` },
    { k: 'uy',     t: '¡Uy!',    svg: `<svg ${S_}><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="16" rx="2" ry="2.6"/><path d="M8 9.2v.2M16 9.2v.2M7 6.8l2-.8M17 6.8l-2-.8"/></svg>` },
    { k: 'gg',     t: 'GG',      svg: `<svg ${S_}><rect x="3" y="5" width="18" height="14" rx="5"/><path d="M10.5 10.2a2.6 2.6 0 1 0 0 3.6V12H9M17.5 10.2a2.6 2.6 0 1 0 0 3.6V12H16"/></svg>` },
    { k: 'vamos',  t: '¡Vamos!', svg: `<svg ${S_}><path d="m13 3-8 11h6l-1 7 8-11h-6l1-7Z"/></svg>` },
    { k: 'risa',   t: 'Jaja',    svg: `<svg ${S_}><circle cx="12" cy="12" r="9"/><path d="M7.5 13.5c.8 3 2.4 4 4.5 4s3.7-1 4.5-4Z"/><path d="M8.2 9.4c.5-.7 1.3-.7 1.8 0M14 9.4c.5-.7 1.3-.7 1.8 0"/></svg>` }
  ];
  let lastReact = 0, reactCool = 0;
  const reactEl = () => document.getElementById('react'), popEl = () => document.getElementById('rpop');

  function setupReactions() {
    const b = reactEl(), pop = popEl(); if (!b || !pop) return;
    b.hidden = false; pop.hidden = true; b.setAttribute('aria-expanded', 'false');
    pop.innerHTML = REACTS.map(r => `<button type="button" role="menuitem" data-r="${r.k}" aria-label="${r.t}">${r.svg}<span>${r.t}</span></button>`).join('');
    b.onclick = ev => { ev.stopPropagation(); const open = pop.hidden; pop.hidden = !open; b.setAttribute('aria-expanded', String(open)); Sfx.play('tap'); };
    pop.onclick = ev => { const x = ev.target.closest('[data-r]'); if (x) sendReact(x.dataset.r); };
    document.addEventListener('click', closePop);
  }
  function closePop(ev) {
    const pop = popEl(); if (!pop || pop.hidden) return;
    if (ev && ev.target && (ev.target.closest('#rpop') || ev.target.closest('#react'))) return;
    pop.hidden = true; const b = reactEl(); b && b.setAttribute('aria-expanded', 'false');
  }
  function teardownReactions() {
    const b = reactEl(), pop = popEl(); if (b) b.hidden = true; if (pop) pop.hidden = true;
    document.removeEventListener('click', closePop);
  }
  async function sendReact(k) {
    if (!fb || !code || !G || G.over) return;
    const now = Date.now();
    if (now < reactCool) return;                       // máx. una cada 2 s, para no saturar
    reactCool = now + 2000; closePop();
    const id = now * 10 + seat;
    lastReact = id;
    showReact(seat, k);
    quiet(fb.set(`rooms/${code}/react`, { by: seat, k, id, at: fb.now() }));
  }
  function handleReact(r) {
    if (!r || !r.id || r.id === lastReact) return;
    const first = lastReact === 0;                     // al entrar no mostramos reacciones viejas
    lastReact = r.id;
    if (first && fb.now() - (r.at || 0) > 4000) return;
    if (r.by === seat || !REACTS.some(x => x.k === r.k)) return;
    showReact(r.by, r.k);
  }
  function showReact(by, k) {
    const r = REACTS.find(x => x.k === k), pill = document.getElementById('pl' + by); if (!r || !pill) return;
    const rc = pill.getBoundingClientRect(), el = document.createElement('div');
    el.className = 'rfx p' + by; el.innerHTML = `${r.svg}<span>${r.t}</span>`;
    el.style.left = (rc.left + rc.width / 2) + 'px'; el.style.top = (rc.bottom + 6) + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 2400);
    if (by !== seat) Sfx.play('tap');
  }

  function onRoom(r) {
    if (!code) return;
    if (!r) {                                         // el creador cerró la sala
      const inGame = S && S.online;
      leave(); S = null; closeSheet(); showView('home');
      toast(inGame ? 'La sala se cerró' : 'La sala ya no existe');
      return;
    }
    const s = r.members && r.members[uid];
    if (s == null) {                                  // ya no estoy en la sala (empezaron sin mí)
      const inGame = S && S.online;
      leave(); S = null; closeSheet(); showView('home');
      toast(inGame ? 'Saliste de la sala' : 'El creador empezó la partida sin ti');
      return;
    }
    if (s !== seat) { seat = s; bindPresence(); if (G) G.me = s; }
    room = r;
    handleReact(r.react);
    const g = norm(r.game);
    if (g.status === 'waiting') { if (!$('#lobby').hidden) showRoom(); return; }
    if (!G || G.round !== g.round || G.players.length !== g.n) startRound(r, g);
    apply();
  }

  function startRound(r, g) {
    const th = THEMES.find(t => t.id === r.config.theme) || THEMES[0], nm = namesOf(r, g.n);
    G = {
      online: true, me: seat, round: g.round, rematch: g.round > 1, status: g.status, th,
      size: SIZES[r.config.size] || SIZES['16'], sizeKey: r.config.size, pool: r.config.pool || [],
      players: nm.map(name => ({ name, score: 0, used: {}, shield: false, frozen: false, short: false, last: null, lastAt: 0 })),
      turn: g.turn, first: null, busy: false, magnet: false, over: false, pending: false, peeking: 0,
      cards: g.deck.map((sym, i) => ({ id: i, sym, up: false, matched: false, owner: -1, quar: -1, el: null }))
    };
    lastEv = g.ev ? g.ev.id : 0;                      // no repetir avisos viejos
    setupReactions();
    prev = null; presWas = [];
    clearTimeout(timer); timerKey = ''; clearTimeout(clockTimer); clockKey = '';
    mountGame(G);
    clearInterval(ticker); ticker = setInterval(tick, 250);
    if (g.round > 1) toast(g.turn === seat ? 'Nueva partida: empiezas tú' : `Nueva partida: empieza ${G.players[g.turn].name}`);
  }

  /* Copia el estado de Firebase a la partida en pantalla */
  function apply() {
    if (!G || S !== G || !room) return;
    const g = norm(room.game), n = g.n, nm = namesOf(room, n);
    g.deck.forEach((sym, i) => {                      // Barajar cambia el símbolo de cada posición
      const c = G.cards[i]; if (!c || c.sym === sym) return;
      c.sym = sym; c.el.querySelector('.front').innerHTML = svgOf(G.th.icons[sym]);
    });
    /* Cegera de quien tiene el turno: los demás no ven las cartas que voltea (solo en pantalla; el estado no cambia) */
    G.hidden = G.hidden || new Set();
    const hideOn = g.status === 'playing' && g.turn !== seat && !!g.short[g.turn];
    G.hidden.clear(); if (hideOn) g.open.forEach(i => G.hidden.add(i));
    const fresh = [];
    g.owner.forEach((o, i) => { const c = G.cards[i]; if (o >= 0 && !c.matched) fresh.push(c); c.owner = o; c.matched = o >= 0; c.up = g.open.includes(i) && !G.hidden.has(i); });
    G.turn = g.turn; G.status = g.status; G.me = seat;
    g.quar.forEach((q, i) => { if (G.cards[i]) G.cards[i].quar = q; });
    if (g.turn !== seat) G.marks = null;
    G.players.forEach((p, i) => {
      const k = 'p' + i, pres = room.players && room.players[k];
      p.name = nm[i]; p.score = g.scores[i]; p.used = g.used[k]; p.frozen = !!g.frozen[i]; p.shield = !!g.shield[i]; p.short = !!g.short[i]; p.last = g.last[i] || null; p.lastAt = g.lastAt[i] || 0;
      p.offline = !(pres && pres.online);
      if (i !== seat && presWas[i] != null && presWas[i] !== !p.offline) toast(p.offline ? `${p.name} se desconectó` : `${p.name} volvió`);
      presWas[i] = !p.offline;
    });
    const sum = a => a.reduce((x, y) => x + y, 0);
    if (prev && prev.round === g.round) {
      if (g.turn === seat && prev.turn !== seat && g.open.length === 0) hap([15, 40, 15]);   // te toca
      if (g.turn !== seat && g.open.length > prev.open.length) Sfx.play('flip');          // volteó otro jugador
      if (sum(g.scores) > sum(prev.scores)) { Sfx.play('match'); G.marks = null; g.scores.forEach((v, i) => { for (let k = v - prev.scores[i]; k > 0; k--) statHit(G, i); if (v > prev.scores[i]) fxMatch(G, fresh.length ? fresh : [], i); }); }
      else if (prev.open.length === 2 && g.open.length === 0) { Sfx.play('miss'); statMiss(G, prev.turn); }
    }
    prev = { round: g.round, open: g.open.slice(), scores: g.scores.slice(), turn: g.turn };
    G.first = g.open.length === 1 ? G.cards[g.open[0]] : null;
    G.busy = g.open.length === 2 || G.pending || G.peeking > 0;
    if (g.turn !== seat) G.magnet = false;
    handleEvent(g.ev);
    schedule(g);
    scheduleClock(g);
    if (g.status === 'over' && !G.over) finish(G); else sync();
  }

  function handleEvent(ev) {
    if (!ev || ev.id === lastEv) return;
    lastEv = ev.id;
    const mine = ev.by === seat, P = POWERS[ev.pid] || {}, eff = ev.eff || ev.pid, nm = i => (G.players[i] && G.players[i].name) || 'Jugador';
    const who = nm(ev.by), vic = ev.victim != null ? ev.victim : -1;
    Sfx.play(ev.kind === 'power' ? sfxOf(ev.pid) : ev.kind === 'blocked' ? 'block' : ev.kind === 'timeout' ? 'timeout' : ev.kind === 'skip' ? 'freeze' : ev.kind === 'close' ? 'miss' : '');
    if (ev.kind === 'power') {
      if (ev.pid === 'mirror') toast(mine ? `Copiaste ${POWERS[eff].name}` : `${who} copió ${POWERS[eff].name}`);
      if (eff === 'freeze') toast(ev.now ? (vic === seat ? 'Te congelaron: pierdes este turno' : `${nm(vic)} pierde su turno`) : vic === seat ? 'Te congelaron: pierdes tu próximo turno' : `${nm(vic)} perderá su próximo turno`);
      else if (eff === 'shield') toast(mine ? 'Activaste tu Escudo (dura 1 ronda)' : `${who} activó su Escudo`);
      else if (eff === 'shuffle') { toast(mine ? 'Barajaste las cartas' : `${who} barajó las cartas`); shuffleFx(); }
      else if (eff === 'swap') toast(mine ? 'Intercambio: tu carta se cambió por otra al azar' : `${who} usó Intercambio: una carta cambió de lugar`);
      else if (eff === 'quarantine') toast(mine ? 'Aislaste una carta hasta tu próximo turno' : `${who} aisló una carta hasta su próximo turno`);
      else if (eff === 'short') toast(mine ? 'Cegera: los demás no verán tus cartas este turno' : `${who} usó Cegera: no verás sus cartas este turno`);
      else if (!mine && ev.pid !== 'mirror') toast(`${who} usó ${P.name}`);
    } else if (ev.kind === 'blocked') {
      toast(vic === seat ? `Tu escudo bloqueó ${P.name} de ${who}` : mine ? `El escudo de ${nm(vic)} bloqueó ${P.name}` : `El escudo de ${nm(vic)} bloqueó a ${who}`);
    } else if (ev.kind === 'timeout') {
      toast(mine ? 'Se acabó tu tiempo' : `A ${who} se le acabó el tiempo`);
    } else if (ev.kind === 'skip') {
      toast(mine ? 'Estás congelado: pierdes este turno' : `${who} pierde su turno`);
    }
  }

  function shuffleFx() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    G.cards.forEach((c, i) => {
      if (c.matched) return;
      const dx = (Math.random() - .5) * 28, dy = (Math.random() - .5) * 28, r = (Math.random() - .5) * 18;
      c.el.animate([{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) rotate(${r}deg) scale(.9)` }, { transform: 'none' }],
        { duration: 700, delay: (i % 6) * 25, easing: 'cubic-bezier(.3,.9,.3,1)' });
    });
  }

  /* Dos cartas abiertas: las resuelve quien tiene el turno (o los demás, más tarde, si este se desconecta) */
  function schedule(g) {
    if (g.open.length !== 2 || g.status !== 'playing') { clearTimeout(timer); timerKey = ''; return; }
    const key = `${g.round}:${g.open.join(',')}:${g.openedAt}`;
    if (key === timerKey) return;
    timerKey = key; clearTimeout(timer);
    timer = setTimeout(resolve, g.turn === seat ? 1000 : 4500);
  }
  /* Máscara de jugadores desconectados (se salta su turno). Se calcula con lo último que vio este cliente. */
  const offMask = n => Array.from({ length: n }, (_, i) => i !== seat && isOff(room, i));
  /* Cambio de turno: Cegera dura un turno; Escudo y Cuarentena se acaban al empezar el siguiente turno de su dueño.
     Se salta a los desconectados y a los congelados (el congelado pierde ese turno y se descongela). Devuelve los congelados saltados. */
  function passTurn(g, was, off) {
    const n = g.n, skipped = [];
    g.short[was] = false;
    const release = p => { g.quar = g.quar.map(q => q === p ? -1 : q); g.shield[p] = false; };
    let found = -1;
    for (let k = 1; k <= n && found < 0; k++) {
      const c = (was + k) % n;
      if (c === was) { found = was; break; }
      if (off && off[c]) { release(c); continue; }
      if (g.frozen[c]) { g.frozen[c] = false; skipped.push(c); release(c); continue; }
      found = c;
    }
    g.turn = found; release(found);
    return skipped;
  }

  async function resolve() {
    if (!code) return;
    const off = offMask(room ? norm(room.game).n : 2);
    try {
      await fb.tx(gp(), cur => {
        if (!cur) return cur;
        const g = norm(cur);
        if (g.open.length !== 2 || g.status !== 'playing') return;
        const [a, b] = g.open;
        if (g.deck[a] === g.deck[b]) {
          g.owner[a] = g.owner[b] = g.turn; g.scores[g.turn]++;
          if (g.owner.every(o => o >= 0)) g.status = 'over';
        } else {
          const sk = passTurn(g, g.turn, off);
          if (sk.length) g.ev = { id: (g.ev ? g.ev.id : 0) + 1, kind: 'skip', by: sk[0] };
        }
        g.open = []; g.openedAt = 0; g.turnAt = fb.now();   // nueva jugada: reloj desde cero
        return g;
      });
    } catch (e) { timerKey = ''; }
  }

  /* ---------- Tiempo por jugada ---------- */
  function scheduleClock(g) {
    if (g.status !== 'playing' || !g.turnAt || g.open.length === 2) { clearTimeout(clockTimer); clockKey = ''; return; }
    const key = `${g.round}:${g.turn}:${g.turnAt}`;
    if (key === clockKey) return;
    clockKey = key; clearTimeout(clockTimer);
    // Quien tiene el turno cierra su propio tiempo; los demás lo hacen 2 s después por si ese jugador se desconectó
    const wait = g.turnAt + TURN_MS - fb.now() + (g.turn === seat ? 0 : 2000);
    clockTimer = setTimeout(() => expire(g.turnAt), Math.max(0, wait));
  }
  async function expire(turnAt) {
    if (!code) return;
    const off = offMask(room ? norm(room.game).n : 2);
    try {
      await fb.tx(gp(), cur => {
        if (!cur) return cur;
        const g = norm(cur);
        if (g.status !== 'playing' || g.turnAt !== turnAt || g.open.length === 2 || fb.now() < g.turnAt + TURN_MS - 250) return;
        const was = g.turn;
        g.open = []; g.openedAt = 0;
        passTurn(g, was, off);                                       // salta desconectados y congelados
        g.turnAt = fb.now();
        g.ev = { id: (g.ev ? g.ev.id : 0) + 1, kind: 'timeout', by: was };
        return g;
      });
    } catch (e) { clockKey = ''; }
  }
  function tick() {
    if (!G || S !== G || !room) return;
    const g = norm(room.game), live = g.status === 'playing' && g.turnAt && !G.over;
    const ms = live ? Math.max(0, g.turnAt + TURN_MS - fb.now()) : 0;
    const left = live ? Math.ceil(ms / 1000) : null;
    for (let i = 0; i < g.n; i++) {
      const bar = document.querySelector(`#pl${i} .tbar`); if (!bar) continue;
      const on = live && g.turn === i && g.open.length < 2;
      bar.classList.toggle('run', on); bar.classList.toggle('low', on && ms <= 5000);
      bar.style.transform = `scaleX(${on ? ms / TURN_MS : 0})`;
    }
    const k = `${g.turnAt}`;
    if (live && g.turn === seat && left <= 5 && warned !== k) { warned = k; hap(10); }
    if (live && g.turn === seat && left <= 5 && left > 0 && left !== lastTick) Sfx.play('tick');
    lastTick = left;
    if (left !== G.left) { G.left = left; sync(); }
  }

  /* ---------- Jugadas propias ---------- */
  async function flip(c) {
    if (!G || G.pending || G.busy) return;
    const idx = c.id;
    G.pending = true; G.busy = true; c.up = true; sync(); hap(8); Sfx.play('flip');   // se voltea al instante
    let res = null;
    try {
      res = await fb.tx(gp(), cur => {
        if (!cur) return cur;
        const g = norm(cur);
        if (g.status !== 'playing' || g.turn !== seat || g.open.length >= 2 || g.owner[idx] >= 0 || g.open.includes(idx)) return;
        const freeQ = g.owner.filter((o, k) => o < 0 && !g.open.includes(k) && g.quar[k] < 0).length;
        if (g.quar[idx] >= 0 && freeQ >= (g.open.length ? 1 : 2)) return;       // carta aislada
        g.open.push(idx);
        if (g.open.length === 2) g.openedAt = Date.now();
        return g;
      });
    } catch (e) { toast('Sin conexión: intenta de nuevo'); }
    G.pending = false;
    const g = res && res.committed ? norm(res.value) : null;
    if (g && G.magnet && g.open.length === 1) {       // Imán: ver dónde está la pareja (solo yo)
      G.magnet = false;
      const p = G.cards.find(x => x !== c && x.sym === c.sym && !x.matched);
      if (p) { toast('Esa es su pareja'); await peekLocal([p], 1300); }
    }
    apply();
  }

  async function power(pid, targets = [], victim = null) {
    if (!G || G.pending) return;
    G.pending = true; G.busy = true; sync(); hap(15);
    const off = offMask(room ? norm(room.game).n : 2);
    let res = null;
    try {
      res = await fb.tx(gp(), cur => {
        if (!cur) return cur;
        const g = norm(cur), me = 'p' + seat, n = g.n;
        const rivals = Array.from({ length: n - 1 }, (_, k) => (seat + 1 + k) % n);      // en orden de turno
        let src = -1;
        if (pid === 'mirror') rivals.forEach(r => { if (g.last[r] && (src < 0 || g.lastAt[r] > g.lastAt[src])) src = r; });
        const eff = pid === 'mirror' ? (src < 0 ? 0 : g.last[src]) : pid;
        if (g.status !== 'playing' || !g.used[me] || g.used[me][pid] || !eff) return;
        if (!['shield', 'swap', 'freeze', 'quarantine'].includes(pid)) {   // Escudo, Intercambio, Congelar y Cuarentena valen en cualquier momento; el resto, no
          if (g.open.length && !((eff === 'magnet' || eff === 'compass') && g.open.length === 1 && g.turn === seat)) return;   // con una carta volteada solo valen el Imán y la Brújula
          if (g.turn !== seat && pid !== 'shuffle') return;     // solo Barajar se puede usar en el turno de otro
        }
        const need = eff === 'compass' && g.open.length === 1 ? 0 : NEED[eff] || 0;
        if (need) {
          if (targets.length !== need || new Set(targets).size !== need) return;
          if (!targets.every(i => Number.isInteger(i) && i >= 0 && i < g.deck.length && g.owner[i] < 0 && !g.open.includes(i) && g.quar[i] < 0)) return;
        }
        let vic = -1;                                          // a quién afecta (Congelar)
        if (VICTIM.includes(eff)) {
          vic = rivals.includes(victim) ? victim : (rivals.length === 1 ? rivals[0] : -1);
          if (vic < 0) return;
          if (vic === g.turn && g.open.length) return;           // ya eligió una carta: no se le puede congelar
        }
        g.used[me][pid] = true;
        const id = (g.ev ? g.ev.id : 0) + 1;
        const blocker = pid === 'shield' ? -1 : vic >= 0 ? (g.shield[vic] ? vic : -1) : rivals.find(r => g.shield[r]) ?? -1;
        if (blocker >= 0) { g.shield[blocker] = false; g.ev = { id, kind: 'blocked', by: seat, pid, victim: blocker }; return g; }
        const ev = { id, kind: 'power', by: seat, pid, eff };
        if (vic >= 0) ev.victim = vic;
        if (eff === 'freeze') {
          if (vic === g.turn) { passTurn(g, vic, off); g.turnAt = fb.now(); ev.now = true; }   // aún no eligió carta: pierde el turno actual
          else g.frozen[vic] = true;
        }
        if (eff === 'short') g.short[seat] = true;
        if (eff === 'shield') g.shield[seat] = true;
        if (eff === 'quarantine') g.quar[targets[0]] = seat;
        if (eff === 'compass' && need) g.open.push(targets[0]);   // la carta elegida se voltea
        if (eff === 'shuffle') {
          const free = g.owner.map((o, i) => (o < 0 && g.quar[i] < 0) ? i : -1).filter(i => i >= 0);
          const syms = shuf(free.map(i => g.deck[i]));
          free.forEach((i, k) => { g.deck[i] = syms[k]; });
        }
        if (eff === 'swap') {                                  // la otra carta es al azar y no se publica cuál fue
          const x = targets[0], others = g.owner.map((ow, k) => (ow < 0 && k !== x && !g.open.includes(k) && g.quar[k] < 0) ? k : -1).filter(k => k >= 0);
          if (!others.length) return;
          const y = others[Math.floor(Math.random() * others.length)];
          [g.deck[x], g.deck[y]] = [g.deck[y], g.deck[x]];
        }
        g.last[seat] = eff; g.lastAt[seat] = id;
        g.ev = ev;
        return g;
      });
    } catch (e) { toast('Sin conexión: intenta de nuevo'); }
    G.pending = false;
    if (res && !res.committed && pid === 'shuffle' && room && norm(room.game).turn !== seat)
      toast('Tarde: ya voltearon una carta. No gastaste el poder');
    const g = res && res.committed ? norm(res.value) : null;
    if (g && g.ev && g.ev.kind === 'power' && g.ev.by === seat) {
      const eff = g.ev.eff || pid;
      if (eff === 'vision') {
        toast('Usaste Visión');
        const pk = shuf(G.cards.filter(c => !c.matched && !c.up)).slice(0, G.size.vision);
        await peekLocal(pk, 1600);
      } else if (eff === 'magnet') {
        const first = g.open.length === 1 ? G.cards[g.open[0]] : null;
        if (first) {                                     // con una carta ya volteada: se ve su pareja al instante
          const p = G.cards.find(x => x !== first && x.sym === first.sym && !x.matched);
          toast('Esa es su pareja'); if (p) await peekLocal([p], 1300);
        } else { G.magnet = true; toast('Voltea una carta: verás su pareja'); }
      } else if (eff === 'compass') {
        const t = G.cards[g.open[0]];
        const twin = G.cards.find(c => c !== t && c.sym === t.sym && !c.matched);
        const dec = rnd(G.cards.filter(c => !c.matched && !c.up && c !== t && c !== twin));
        G.marks = shuf([twin, dec].filter(Boolean)); G.compassFor = t;
        toast('Brújula: una de las 2 cartas marcadas es su pareja');
      }
    }
    apply();
  }

  async function peekLocal(cards, ms) {
    const mine = G;
    mine.peeking++; mine.busy = true;
    cards.forEach(c => c.el.classList.add('peek'));
    await sleep(ms);
    cards.forEach(c => c.el.classList.remove('peek'));
    await sleep(450);
    mine.peeking--;
  }

  async function rematch(reroll) {
    if (!code || !room) return;
    try {
      await fb.tx('rooms/' + code, cur => {
        if (!cur || !cur.game) return cur;
        const g = norm(cur.game);
        if (g.status !== 'over') return;
        if (reroll) cur.config.pool = shuf(PIDS).slice(0, 3);          // nuevos poderes para la revancha
        cur.game = newGame(cur.config, g.round + 1, g.ev ? g.ev.id : 0, g.n);
        return cur;
      });
    } catch (e) { toast('Sin conexión: intenta de nuevo'); }
  }

  /* ---------- Empezar (solo el creador) ---------- */
  async function start() {
    if (!code || seat !== 0 || !room) return;
    const btn = $('#startGame'); btn.disabled = true;
    try {
      const res = await fb.tx('rooms/' + code, cur => {
        if (!cur || cur.host !== uid || !cur.game || cur.game.status !== 'waiting') return;
        const pl = cur.players || {};
        const list = Object.entries(cur.members || {})
          .filter(([u, s]) => u === cur.host || (pl['p' + s] && pl['p' + s].online))   // se quedan los conectados
          .sort((a, b) => a[1] - b[1]);
        if (list.length < 2) return;
        const members = {}, players = {};
        list.forEach(([u, s], i) => { members[u] = i; players['p' + i] = pl['p' + s]; });   // asientos 0..n-1, el creador siempre en 0
        cur.members = members; cur.players = players;
        if (cur.config.auto) cur.config.size = list.length >= 3 ? '36' : '16';
        cur.game = newGame(cur.config, 1, cur.game.ev ? cur.game.ev.id : 0, list.length);
        return cur;
      });
      if (!res.committed) toast('Necesitas al menos 2 jugadores conectados');
    } catch (e) { toast('Sin conexión: intenta de nuevo'); }
    showRoomButtons();
  }

  /* ---------- Salir ---------- */
  function leave() {
    clearTimeout(timer); timerKey = ''; clearTimeout(clockTimer); clockKey = ''; clearInterval(ticker); ticker = null;
    unsub.forEach(f => f()); unsub = [];
    if (fb && code) {
      const waiting = !room || norm(room.game).status === 'waiting';
      if (presPath) quiet(fb.cancelOnDisconnect(presPath));
      if (seat === 0 && waiting) quiet(fb.remove('rooms/' + code));
      else if (waiting && seat > 0) {                  // en la sala de espera: libero mi lugar
        const c = code, s = seat;
        quiet(fb.tx('rooms/' + c, cur => {
          if (!cur) return cur;
          if (cur.members && cur.members[uid] === s) delete cur.members[uid];
          if (cur.players) delete cur.players['p' + s];
          return cur;
        }));
      }
      else if (presPath) quiet(fb.set(presPath, false));
    }
    presPath = '';
   
    teardownReactions(); lastReact = 0; reactCool = 0;
    code = null; seat = -1; room = null; G = null;
    try { if (location.search) history.replaceState(null, '', location.pathname); } catch (e) {}
  }
  function fail(e) {
    leave(); showView('home');
    toast(e && e.message ? e.message : 'Algo salió mal con la conexión');
  }

  /* ---------- Pantalla de sala ---------- */
  function showLobby(pane, text) {
    if ($('#lobby').hidden) showView('lobby');       // si ya se ve, no se repite la animación de entrada (se notaba al cambiar el nombre)
    ['room', 'join', 'busy'].forEach(k => { $('#' + k + 'Pane').hidden = k !== pane; });
    $('#roomFoot').hidden = pane !== 'room';
    if (pane === 'busy') $('#busyText').textContent = text || 'Conectando…';
    $('#lobbyTitle').textContent = pane === 'room' ? (seat === 0 ? 'Tu sala' : 'Sala') : pane === 'join' ? 'Unirse a una sala' : 'En línea';
  }
  const PUBLIC_URL = 'https://parejas-explosivas.web.app/';      // en la app nativa el origen es local: el enlace usa la web publicada
  const link = () => (NATIVE ? PUBLIC_URL : location.href.split(/[?#]/)[0]) + '?sala=' + code;
  let rosterSig = '', codeShown = '';
  function showRoom() {
    if ($('#roomPane').hidden) { rosterSig = ''; codeShown = ''; }
    showLobby('room');
    if (codeShown !== code) {
      codeShown = code;
      $('#roomCode').textContent = code;
      $('#qr').innerHTML = qrSvg(link());
      const isLocal = location.protocol === 'file:' || /^(localhost|127\.|\[::1\])/.test(location.hostname);
      $('#qrNote').hidden = !isLocal;
      $('#qrNote').textContent = 'Estás abriendo el juego desde tu computador: el QR solo funcionará en otro celular cuando el juego esté publicado. Mientras tanto, usen el código.';
      $('#copyLink').textContent = (NATIVE || navigator.share) ? 'Compartir enlace' : 'Copiar enlace';
    }
    renderRoster();
    showRoomButtons();
  }
  let sizeShown = '';
  const sizeNow = online => room.config.auto ? (online >= 3 ? '36' : '16') : (room.config.size || '16');
  function renderRoster() {
    if (!room) return;
    const mem = room.members || {}, bySeat = {};
    Object.entries(mem).forEach(([u, s]) => { bySeat[s] = u; });
    const nm = namesOf(room, MAXP);
    const sig = JSON.stringify(Array.from({ length: MAXP }, (_, i) => bySeat[i] == null ? 0 : [bySeat[i] === room.host, isOff(room, i), i === seat ? '' : nm[i]])) + seat;
    if (sig === rosterSig) return;
    rosterSig = sig;
    const ul = $('#roster'), act = document.activeElement, own = ul.querySelector('input'), keep = own && act === own ? { v: own.value, a: own.selectionStart, b: own.selectionEnd } : null;
    ul.innerHTML = Array.from({ length: MAXP }, (_, i) => {
      if (bySeat[i] == null) return `<li class="rs empty"><i class="rd"></i><span class="rn">Esperando jugador…</span></li>`;
      const me = i === seat, tag = bySeat[i] === room.host ? 'Creador' : isOff(room, i) ? 'Desconectado' : '';
      const nameEl = me
        ? `<input class="rin" id="myName" maxlength="${NAME_MAX}" value="${((raw => raw === defName(i) ? raw : (cleanName(raw) || defName(i)))(String((room.players['p' + i] && room.players['p' + i].name) || ''))).replace(/"/g, '&quot;')}" aria-label="Tu nombre (máx. ${NAME_MAX} letras)" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done">`
        : `<span class="rn">${nm[i]}</span>`;
      return `<li class="rs p${i}${me ? ' me' : ''}"><i class="rd"></i>${nameEl}${me ? '<em>tú</em>' : ''}${tag ? `<small>${tag}</small>` : ''}</li>`;
    }).join('');
    const inp = $('#myName');
    if (inp) {
      inp.oninput = () => { const v = cleanName(inp.value); if (v !== inp.value) inp.value = inp.value.replace(/[<>&"'`\\]/g, '').slice(0, NAME_MAX); saveName(inp.value); };
      inp.onblur = () => { if (!cleanName(inp.value)) { inp.value = defName(seat); saveName(''); } };
      inp.onkeydown = ev => { if (ev.key === 'Enter') inp.blur(); };
      if (keep) { inp.focus(); inp.value = keep.v; try { inp.setSelectionRange(keep.a, keep.b); } catch (e) {} }
    }
  }
  let nameTimer = null;
  function saveName(v) {
    const clean = cleanName(v);
    cfg.name = clean; saveCfg();
    clearTimeout(nameTimer);
    const s = seat, c = code;
    nameTimer = setTimeout(() => { if (fb && c && c === code && s === seat) quiet(fb.set(`rooms/${c}/players/p${s}/name`, clean || defName(s))); }, 250);
  }
  function showRoomButtons() {
    if (!room) return;
    const online = Object.values(room.members || {}).filter(s => s === 0 || !isOff(room, s)).length;
    const host = seat === 0, btn = $('#startGame');
    btn.hidden = !host; btn.disabled = online < 2;
    btn.textContent = online < 2 ? 'Empezar partida' : `Empezar con ${online} jugadores`;
    const sz = sizeNow(online);
    if (host) {
      if (sizeShown !== sz) { sizeShown = sz; seg($('#roomSize'), Object.entries(SIZES).map(([k, z]) => [k, z.label]), () => sizeNow(online), v => {
        quiet(fb.set(`rooms/${code}/config/size`, v)); quiet(fb.set(`rooms/${code}/config/auto`, false)); room.config.size = v; room.config.auto = false; sizeShown = v; showRoomButtons(); }); }
      $('#roomSize').hidden = false;
    } else { $('#roomSize').hidden = true; sizeShown = ''; }
    $('#roomSizeNote').textContent = host
      ? (sz === '16' && online >= 3 ? 'Con 3 o 4 jugadores se recomienda 6 × 6. Toca para cambiarlo.' : 'Toca para cambiar el tablero.')
      : `El creador juega en ${SIZES[sz].label}.`;
    const hn = namesOf(room, 1)[0];
    $('#roomWait').hidden = false;
    $('#hostStatus').textContent = host ? (online < 2 ? 'Esperando jugadores… (hasta 4)' : online < MAXP ? 'Puedes empezar ya o esperar a más jugadores' : 'Sala llena: ¡a jugar!') : `Esperando que ${hn} inicie la partida…`;
  }

  function qrSvg(text) {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR para unirse a la sala ${code}"><path d="${d}" fill="#1D1D1F"/></svg>`;
  }

  $('#copyLink').onclick = async () => {
    const url = link();
    try {
      if (NATIVE) { try { await nativeCall('Share', 'share', { title: 'Boom Duo', text: `Únete a mi sala: ${code}`, url }); } catch (e) { if (navigator.share) await navigator.share({ title: 'Boom Duo', text: `Únete a mi sala: ${code}`, url }); else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } } }
      else if (navigator.share) await navigator.share({ title: 'Boom Duo', text: `Únete a mi sala: ${code}`, url });
      else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); }
    } catch (e) { /* el usuario canceló */ }
  };
  $('#startGame').onclick = start;
  $('#lobbyBack').onclick = () => { leave(); showView('home'); };
  $('#joinForm').onsubmit = ev => { ev.preventDefault(); join($('#codeInput').value); };
  $('#codeInput').oninput = ev => {
    const v = ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (v !== ev.target.value) ev.target.value = v;
    $('#joinErr').textContent = '';
  };

  // Entrar directo con el enlace o el QR: ?sala=CODIGO
  const fromUrl = new URLSearchParams(location.search).get('sala');
  if (fromUrl) join(fromUrl);

  return { turnSeconds: Math.round(TURN_MS / 1000), create, openJoin, join, flip, power, rematch, leave, get state() { return { code, seat, room, G }; } };
})();
