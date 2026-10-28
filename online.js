'use strict';
/* ====================== Modo en línea (Firebase Realtime Database) ======================
   Una sala vive en rooms/CODIGO:
   {
     host, guest, createdAt,                       // uid del creador y del invitado
     config:  { size, theme, pool },               // lo que eligió el creador
     players: { p0: { online }, p1: { online } },  // presencia (onDisconnect)
     game: {
       round, status: 'waiting' | 'playing' | 'over',
       deck:  [símbolo por posición], owner: [-1 | 0 | 1 por posición],
       open:  [posiciones volteadas (máx. 2)], openedAt,
       turn, scores: [a, b], used: { p0: {poder: true}, p1: {...} },
       frozen: [bool, bool], shield: [bool, bool],
       turnAt,                                     // hora del servidor en que empezó la jugada actual
       ev: { id, kind, by, pid }                   // último evento, para avisos en ambas pantallas
     }
   }
   Toda jugada se escribe con una transacción, así dos toques al mismo tiempo no rompen el estado.
   Visión e Imán solo se muestran en la pantalla de quien los usa.
   Cada jugada (elegir una pareja) tiene TURN_MS; si se acaba, el turno pasa al rival. */
const Online = (() => {
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin 0, O, 1 ni I
  const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
  let fb = null, uid = null;                          // backend y usuario anónimo
  let code = null, seat = -1, room = null, G = null;  // sala actual, mi asiento (0 = creador)
  let unsub = [], lastEv = 0, timer = null, timerKey = '', rivalWasOnline = null;
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
  async function connect() {
    await withTimeout(ensureFB(), 20000, 'No se pudo cargar Firebase. Revisa tu conexión.');
    if (!uid) uid = await withTimeout(fb.signIn(), 20000, 'No se pudo conectar con Firebase.');
  }
  const gp = () => `rooms/${code}/game`;
  const quiet = p => { if (p && p.catch) p.catch(() => {}); };

  /* ---------- Estado de la partida ---------- */
  const fill = (a, n, d) => Array.from({ length: n }, (_, i) => (a && a[i] != null) ? a[i] : d);
  function norm(g) {                                   // Firebase borra arrays/objetos vacíos: se reconstruyen
    g = g || {};
    const n = g.deck ? g.deck.length : 0;
    return {
      round: g.round || 1, status: g.status || 'waiting',
      deck: fill(g.deck, n, 0), owner: fill(g.owner, n, -1),
      open: g.open ? Object.values(g.open) : [], openedAt: g.openedAt || 0,
      turn: g.turn || 0, scores: fill(g.scores, 2, 0),
      used: { p0: { ...(g.used && g.used.p0) }, p1: { ...(g.used && g.used.p1) } },
      frozen: fill(g.frozen, 2, false), shield: fill(g.shield, 2, false),
      turnAt: g.turnAt || 0, ev: g.ev || null
    };
  }
  function newGame(config, round, evId) {
    const th = THEMES.find(t => t.id === config.theme) || THEMES[0], z = SIZES[config.size] || SIZES['16'];
    const syms = shuf([...Array(th.icons.length).keys()]).slice(0, z.pairs);
    const deck = shuf([...syms, ...syms]);
    return {
      round, status: 'playing', deck, owner: deck.map(() => -1), turn: (round - 1) % 2,
      scores: [0, 0], frozen: [false, false], shield: [false, false], turnAt: fb.now(),
      ev: { id: (evId || 0) + 1, kind: 'round', by: 0 }
    };
  }
  const genCode = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), n => ALPHA[n % ALPHA.length]).join('');

  /* ---------- Crear sala ---------- */
  async function create() {
    showLobby('busy', 'Creando sala…');
    try {
      await connect();
      const pool = cfg.powerMode === 'random' ? shuf(PIDS).slice(0, 3) : PIDS.filter(p => cfg.picked.includes(p));
      const config = { size: cfg.size, theme: cfg.theme, pool };
      for (let i = 0; i < 5 && !code; i++) {
        const c = genCode(), game = newGame(config, 1, 0);
        game.status = 'waiting';
        const r = await fb.tx('rooms/' + c, cur => cur === null ? { host: uid, createdAt: Date.now(), config, game } : undefined);
        if (r.committed) { code = c; seat = 0; }
      }
      if (!code) throw new Error('No se pudo crear la sala. Intenta de nuevo.');
      await enterRoom();
      showHost();
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
      const r = await fb.get('rooms/' + c);
      if (!r) throw new Error('No existe una sala con ese código.');
      if (r.host === uid) seat = 0;                    // volver a mi propia sala (recargué la página)
      else if (r.guest === uid) seat = 1;              // volver como invitado
      else if (r.guest) throw new Error('Esa sala ya está llena.');
      else {
        const res = await fb.tx('rooms/' + c, cur => {
          if (!cur) return cur;
          if (cur.guest && cur.guest !== uid) return;  // alguien se unió primero: cancelar
          cur.guest = uid;
          if (cur.game && cur.game.status === 'waiting') { cur.game.status = 'playing'; cur.game.turnAt = fb.now(); }
          return cur;
        });
        if (!res.value) throw new Error('No existe una sala con ese código.');
        if (res.value.guest !== uid) throw new Error('Esa sala ya está llena.');
        seat = 1;
      }
      code = c;
      await enterRoom();
    } catch (e) {
      seat = -1; code = null;
      openJoin(); $('#codeInput').value = c; $('#joinErr').textContent = e.message || 'No se pudo unir a la sala.';
    }
  }

  async function enterRoom() {
    const me = `rooms/${code}/players/p${seat}`;
    await fb.set(me, { online: true });
    quiet(fb.onDisconnectSet(me + '/online', false));
    try { history.replaceState(null, '', location.pathname + '?sala=' + code); } catch (e) {}
    lastEv = 0; rivalWasOnline = null;
    unsub.push(fb.on('rooms/' + code, onRoom));
  }

  /* ---------- Escuchar la sala ---------- */

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
    room = r;
    handleReact(r.react);
    const g = norm(r.game);
    if (g.status === 'waiting') { if (seat === 0 && $('#lobby').hidden === false) showHost(); return; }
    if (!G || G.round !== g.round) startRound(r, g);
    apply();
  }

  function startRound(r, g) {
    const th = THEMES.find(t => t.id === r.config.theme) || THEMES[0];
    G = {
      online: true, me: seat, round: g.round, rematch: g.round > 1, status: g.status, th,
      size: SIZES[r.config.size] || SIZES['16'], sizeKey: r.config.size, pool: r.config.pool || [],
      players: [0, 1].map(i => ({ name: i === seat ? 'Tú' : 'Rival', score: 0, used: {}, shield: false, frozen: false })),
      turn: g.turn, first: null, busy: false, magnet: false, over: false, pending: false, peeking: 0,
      cards: g.deck.map((sym, i) => ({ id: i, sym, up: false, matched: false, owner: -1, el: null }))
    };
    lastEv = g.ev ? g.ev.id : 0;                      // no repetir avisos viejos
    setupReactions();
    prev = null;
    clearTimeout(timer); timerKey = ''; clearTimeout(clockTimer); clockKey = '';
    mountGame(G);
    clearInterval(ticker); ticker = setInterval(tick, 250);
    if (g.round > 1) toast(g.turn === seat ? 'Nueva partida: empiezas tú' : 'Nueva partida: empieza tu rival');
  }

  /* Copia el estado de Firebase a la partida en pantalla */
  function apply() {
    if (!G || S !== G || !room) return;
    const g = norm(room.game);
    g.deck.forEach((sym, i) => {                      // Barajar cambia el símbolo de cada posición
      const c = G.cards[i]; if (!c || c.sym === sym) return;
      c.sym = sym; c.el.querySelector('.front').innerHTML = svgOf(G.th.icons[sym]);
    });
    const fresh = [];
    g.owner.forEach((o, i) => { const c = G.cards[i]; if (o >= 0 && !c.matched) fresh.push(c); c.owner = o; c.matched = o >= 0; c.up = g.open.includes(i); });
    G.turn = g.turn; G.status = g.status;
    [0, 1].forEach(i => {
      const p = G.players[i], k = 'p' + i, pres = room.players && room.players[k];
      p.score = g.scores[i]; p.used = g.used[k]; p.frozen = !!g.frozen[i]; p.shield = !!g.shield[i];
      p.offline = !(pres && pres.online);
    });
    const rivalOnline = !G.players[1 - seat].offline;
    if (rivalWasOnline !== null && rivalOnline !== rivalWasOnline) toast(rivalOnline ? 'Tu rival volvió' : 'Tu rival se desconectó');
    rivalWasOnline = rivalOnline;
    if (prev && prev.round === g.round) {
      if (g.turn !== seat && g.open.length > prev.open.length) Sfx.play('flip');          // volteó el rival
      if (g.scores[0] + g.scores[1] > prev.scores[0] + prev.scores[1]) { Sfx.play('match'); [0, 1].forEach(i => { for (let k = g.scores[i] - prev.scores[i]; k > 0; k--) statHit(G, i); if (g.scores[i] > prev.scores[i]) fxMatch(G, fresh.length ? fresh : [], i); }); }
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
    const mine = ev.by === seat, P = POWERS[ev.pid] || {};
    Sfx.play(ev.kind === 'power' ? ev.pid : ev.kind === 'blocked' ? 'block' : ev.kind === 'timeout' ? 'timeout' : ev.kind === 'skip' ? 'freeze' : '');
    if (ev.kind === 'power') {
      if (ev.pid === 'freeze') toast(mine ? 'Tu rival perderá su próximo turno' : 'Te congelaron: pierdes tu próximo turno');
      else if (ev.pid === 'shield') toast(mine ? 'Activaste tu Escudo' : 'Tu rival activó su Escudo');
      else if (ev.pid === 'shuffle') { toast(mine ? 'Barajaste las cartas' : 'Tu rival barajó las cartas'); shuffleFx(); }
      else if (!mine) toast(`Tu rival usó ${P.name}`);
    } else if (ev.kind === 'blocked') {
      toast(mine ? `El escudo de tu rival bloqueó ${P.name}` : `Tu escudo bloqueó ${P.name}`);
    } else if (ev.kind === 'timeout') {
      toast(mine ? 'Se acabó tu tiempo: turno de tu rival' : 'A tu rival se le acabó el tiempo');
    } else if (ev.kind === 'skip') {
      toast(mine ? 'Estás congelado: pierdes este turno' : 'Tu rival pierde su turno');
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

  /* Dos cartas abiertas: las resuelve quien tiene el turno (o el rival si este se desconecta) */
  function schedule(g) {
    if (g.open.length !== 2 || g.status !== 'playing') { clearTimeout(timer); timerKey = ''; return; }
    const key = `${g.round}:${g.open.join(',')}:${g.openedAt}`;
    if (key === timerKey) return;
    timerKey = key; clearTimeout(timer);
    timer = setTimeout(resolve, g.turn === seat ? 1000 : 4500);
  }
  async function resolve() {
    if (!code) return;
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
          const nx = 1 - g.turn;
          if (g.frozen[nx]) { g.frozen[nx] = false; g.ev = { id: (g.ev ? g.ev.id : 0) + 1, kind: 'skip', by: nx }; }
          else g.turn = nx;
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
    // Quien tiene el turno cierra su propio tiempo; el rival lo hace 2 s después por si el otro se desconectó
    const wait = g.turnAt + TURN_MS - fb.now() + (g.turn === seat ? 0 : 2000);
    clockTimer = setTimeout(() => expire(g.turnAt), Math.max(0, wait));
  }
  async function expire(turnAt) {
    if (!code) return;
    try {
      await fb.tx(gp(), cur => {
        if (!cur) return cur;
        const g = norm(cur);
        if (g.status !== 'playing' || g.turnAt !== turnAt || g.open.length === 2 || fb.now() < g.turnAt + TURN_MS - 250) return;
        const was = g.turn, nx = 1 - was;
        g.open = []; g.openedAt = 0;
        if (g.frozen[nx]) g.frozen[nx] = false; else g.turn = nx;   // si el rival estaba congelado, pierde ese turno
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
    [0, 1].forEach(i => {
      const bar = document.querySelector(`#pl${i} .tbar`); if (!bar) return;
      const on = live && g.turn === i && g.open.length < 2;
      bar.classList.toggle('run', on); bar.classList.toggle('low', on && ms <= 5000);
      bar.style.transform = `scaleX(${on ? ms / TURN_MS : 0})`;
    });
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

  async function power(pid) {
    if (!G || G.pending) return;
    G.pending = true; G.busy = true; sync(); hap(15);
    let res = null;
    try {
      res = await fb.tx(gp(), cur => {
        if (!cur) return cur;
        const g = norm(cur), me = 'p' + seat, op = 1 - seat;
        if (g.status !== 'playing' || g.open.length || g.used[me][pid]) return;
        if (g.turn !== seat && pid !== 'shuffle') return;     // solo Barajar se puede usar en el turno del rival
        g.used[me][pid] = true;
        const id = (g.ev ? g.ev.id : 0) + 1;
        if (pid !== 'shield' && g.shield[op]) { g.shield[op] = false; g.ev = { id, kind: 'blocked', by: seat, pid }; return g; }
        if (pid === 'freeze') g.frozen[op] = true;
        if (pid === 'shield') g.shield[seat] = true;
        if (pid === 'shuffle') {
          const free = g.owner.map((o, i) => o < 0 ? i : -1).filter(i => i >= 0);
          const syms = shuf(free.map(i => g.deck[i]));
          free.forEach((i, k) => { g.deck[i] = syms[k]; });
        }
        g.ev = { id, kind: 'power', by: seat, pid };
        return g;
      });
    } catch (e) { toast('Sin conexión: intenta de nuevo'); }
    G.pending = false;
    if (res && !res.committed && pid === 'shuffle' && room && norm(room.game).turn !== seat)
      toast('Tarde: tu rival ya volteó una carta. No gastaste el poder');
    const g = res && res.committed ? norm(res.value) : null;
    if (g && g.ev && g.ev.kind === 'power' && g.ev.by === seat) {
      if (pid === 'vision') {
        toast('Usaste Visión');
        const pk = shuf(G.cards.filter(c => !c.matched && !c.up)).slice(0, G.size.vision);
        await peekLocal(pk, 1600);
      } else if (pid === 'magnet') { G.magnet = true; toast('Voltea una carta: verás su pareja'); }
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

  async function rematch() {
    if (!code || !room) return;
    try {
      await fb.tx(gp(), cur => {
        if (!cur) return cur;
        const g = norm(cur);
        if (g.status !== 'over') return;
        return newGame(room.config, g.round + 1, g.ev ? g.ev.id : 0);
      });
    } catch (e) { toast('Sin conexión: intenta de nuevo'); }
  }

  /* ---------- Salir ---------- */
  function leave() {
    clearTimeout(timer); timerKey = ''; clearTimeout(clockTimer); clockKey = ''; clearInterval(ticker); ticker = null;
    unsub.forEach(f => f()); unsub = [];
    if (fb && code) {
      const p = `rooms/${code}/players/p${seat}/online`;
      if (seat === 0 && (!room || norm(room.game).status === 'waiting')) quiet(fb.remove('rooms/' + code));
      else { quiet(fb.cancelOnDisconnect(p)); quiet(fb.set(p, false)); }
    }
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
    showView('lobby');
    ['host', 'join', 'busy'].forEach(k => { $('#' + k + 'Pane').hidden = k !== pane; });
    if (pane === 'busy') $('#busyText').textContent = text || 'Conectando…';
    $('#lobbyTitle').textContent = pane === 'host' ? 'Tu sala' : pane === 'join' ? 'Unirse a una sala' : 'En línea';
  }
  const link = () => location.href.split(/[?#]/)[0] + '?sala=' + code;
  function showHost() {
    showLobby('host');
    $('#roomCode').textContent = code;
    $('#qr').innerHTML = qrSvg(link());
    const isLocal = location.protocol === 'file:' || /^(localhost|127\.|\[::1\])/.test(location.hostname);
    $('#qrNote').hidden = !isLocal;
    $('#qrNote').textContent = 'Estás abriendo el juego desde tu computador: el QR solo funcionará en otro celular cuando el juego esté publicado. Mientras tanto, usen el código.';
    $('#copyLink').textContent = navigator.share ? 'Compartir enlace' : 'Copiar enlace';
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
      if (navigator.share) await navigator.share({ title: 'Parejas explosivas', text: `Únete a mi sala: ${code}`, url });
      else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); }
    } catch (e) { /* el usuario canceló */ }
  };
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