'use strict';
/* ====================== Sonido: efectos y música (Web Audio, sin archivos) ======================
   Todo se sintetiza en el navegador: no hay archivos de audio que descargar ni licencias.
   - Sfx.play('flip' | 'match' | 'miss' | 'vision' | 'freeze' | 'shuffle' | 'magnet' | 'shield' |
              'block' | 'tick' | 'timeout' | 'start' | 'win' | 'lose' | 'tie' | 'tap')
   - Música generativa tranquila: acordes suaves + notas tipo piano al azar (nunca suena igual).
   Los navegadores bloquean el audio hasta el primer toque del usuario: se activa en ese momento. */
const Sfx = (() => {
  if (cfg.music === undefined) cfg.music = true;
  if (cfg.sfx === undefined) cfg.sfx = true;

  let ctx = null, master, sfxBus, musicBus, verb, echo;
  let musicTimer = null, nextT = 0, step = 0, stopAt = null;
  const MUSIC_VOL = .32;

  /* ---------- Motor ---------- */
  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master = ctx.createGain(); master.gain.value = 2.4;
    master.connect(comp); comp.connect(ctx.destination);
    // Reverberación (sala suave) con un impulso generado
    verb = ctx.createConvolver(); verb.buffer = impulse(2.8);
    const vRet = ctx.createGain(); vRet.gain.value = .35; verb.connect(vRet); vRet.connect(master);
    sfxBus = bus(master, .7);
    musicBus = bus(master, 0);
    // Eco para la música
    echo = ctx.createDelay(1.5); echo.delayTime.value = (60 / BPM / 2) * 3;
    const fbk = ctx.createGain(); fbk.gain.value = .32;
    const eLow = ctx.createBiquadFilter(); eLow.type = 'lowpass'; eLow.frequency.value = 2200;
    echo.connect(eLow); eLow.connect(fbk); fbk.connect(echo); eLow.connect(musicBus);
    return ctx;
  }
  const bus = (to, v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(to); return g; };
  function impulse(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    return b;
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const ready = () => ctx && ctx.state === 'running';

  // Una nota: oscilador con envolvente (ataque rápido, caída exponencial)
  function tone({ f, f2, type = 'sine', t = 0, at, a = .005, d = .25, v = .2, to = sfxBus, wet = 0 }) {
    const t0 = at != null ? at : ctx.currentTime + t;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + a + d);
    g.gain.setValueAtTime(.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + a + d);
    o.connect(g); g.connect(to);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
    o.start(t0); o.stop(t0 + a + d + .05);
  }
  function noise({ t = 0, d = .1, v = .1, type = 'bandpass', fq = 2000, q = 1, to = sfxBus }) {
    const t0 = ctx.currentTime + t, n = Math.ceil(ctx.sampleRate * d);
    const b = ctx.createBuffer(1, n, ctx.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = fq; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
    s.connect(fl); fl.connect(g); g.connect(to); s.start(t0); s.stop(t0 + d + .02);
  }
  // Campana: fundamental + parcial inarmónico
  const bell = (f, t = 0, v = .12, d = .6) => { tone({ f, t, d, v, wet: .4 }); tone({ f: f * 2.76, t, d: d * .4, v: v * .22, wet: .4 }); };

  /* ---------- Efectos ---------- */
  const SOUNDS = {
    tap:     () => tone({ f: 880, d: .04, v: .035 }),
    flip:    () => { tone({ f: 540, f2: 360, type: 'triangle', d: .09, v: .12 }); noise({ d: .035, v: .05, fq: 2600 }); },
    match:   () => { bell(659.25, 0, .13); bell(987.77, .09, .12, .8); },
    miss:    () => { tone({ f: 330, type: 'triangle', d: .16, v: .09 }); tone({ f: 247, type: 'triangle', t: .12, d: .22, v: .09 }); },
    vision:  () => [84, 88, 91, 96].forEach((m, i) => bell(mtof(m), i * .06, .055, .5)),
    freeze:  () => { [2093, 2637, 3136].forEach((f, i) => tone({ f, t: i * .05, d: .5, v: .04, wet: .6 })); noise({ d: .45, v: .03, type: 'highpass', fq: 5000 }); },
    shuffle: () => { for (let i = 0; i < 9; i++) noise({ t: i * .045, d: .045, v: .16, fq: 1800 + Math.random() * 1200, q: 1.5 }); },
    magnet:  () => tone({ f: 220, f2: 660, d: .35, v: .08, wet: .3 }),
    shield:  () => [392, 523.25, 659.25].forEach(f => tone({ f, a: .12, d: .45, v: .05, wet: .5 })),
    block:   () => { tone({ f: 150, f2: 60, d: .2, v: .2 }); noise({ d: .05, v: .08, type: 'lowpass', fq: 900 }); },
    tick:    () => tone({ f: 1480, d: .03, v: .045 }),
    timeout: () => [523.25, 415.3, 329.63].forEach((f, i) => tone({ f, type: 'triangle', t: i * .11, d: .18, v: .07 })),
    start:   () => { bell(523.25, 0, .06); bell(783.99, .1, .06); },
    win:     () => { [72, 76, 79, 84].forEach((m, i) => bell(mtof(m), i * .1, .1, .9)); [60, 64, 67].forEach(m => tone({ f: mtof(m), t: .45, a: .05, d: 1.2, v: .04, wet: .5 })); },
    lose:    () => [67, 64, 60].forEach((m, i) => tone({ f: mtof(m), type: 'triangle', t: i * .2, d: .45, v: .08, wet: .4 })),
    tie:     () => { bell(mtof(72), 0, .08); bell(mtof(72), .18, .08); }
  };
  function play(name) {
    if (!cfg.sfx || !ready()) return;
    try { SOUNDS[name] && SOUNDS[name](); } catch (e) { /* nunca romper el juego por un sonido */ }
  }

  /* ---------- Música generativa ---------- */
  const BPM = 66, EIGHTH = 60 / BPM / 2;
  // Cmaj7 · Am9 · Fmaj7 · G6 (2 compases cada uno)
  const CHORDS = [[36, [60, 64, 67, 71]], [33, [57, 60, 64, 71]], [29, [57, 60, 64, 65]], [31, [55, 59, 62, 64]]];
  function pad(notes, t0, dur) {
    notes.forEach((m, i) => [-6, 6].forEach(det => {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = det + i;
      lp.type = 'lowpass'; lp.frequency.value = 900;
      g.gain.setValueAtTime(.0001, t0);
      g.gain.linearRampToValueAtTime(.014, t0 + 1.8);
      g.gain.setValueAtTime(.014, t0 + dur - .2);
      g.gain.linearRampToValueAtTime(.0001, t0 + dur + 1.6);
      o.connect(lp); lp.connect(g); g.connect(musicBus);
      const w = ctx.createGain(); w.gain.value = .5; g.connect(w); w.connect(verb);
      o.start(t0); o.stop(t0 + dur + 1.7);
    }));
  }
  function pluck(m, t0) {
    const v = .028 + Math.random() * .014;
    [[1, 'sine', v], [2, 'triangle', v * .18]].forEach(([mul, type, vol]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = mtof(m) * mul;
      g.gain.setValueAtTime(.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + 1.6);
      o.connect(g); g.connect(musicBus); g.connect(echo);
      const w = ctx.createGain(); w.gain.value = .4; g.connect(w); w.connect(verb);
      o.start(t0); o.stop(t0 + 1.7);
    });
  }
  function scheduleMusic() {
    if (!ready()) return;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + .05;
    while (nextT < ctx.currentTime + .5) {
      const chord = CHORDS[Math.floor(step / 16) % CHORDS.length], pos = step % 16;
      if (pos === 0) { pad(chord[1], nextT, EIGHTH * 16); tone({ f: mtof(chord[0]), at: nextT, a: .4, d: EIGHTH * 15, v: .05, to: musicBus }); }
      // notas sueltas: sobre todo en tiempos fuertes, con notas del acorde (siempre consonante)
      const p = pos % 4 === 0 ? .45 : pos % 2 === 0 ? .22 : .08;
      if (Math.random() < p) {
        const pool = chord[1].map(n => n + 12).concat([chord[1][0] + 24, chord[1][2] + 14]);
        pluck(pool[Math.floor(Math.random() * pool.length)], nextT + (Math.random() - .5) * .02);
      }
      nextT += EIGHTH; step++;
    }
  }
  function startMusic() {
    if (!init() || !ready()) return;
    clearTimeout(stopAt); stopAt = null;
    if (!musicTimer) { nextT = ctx.currentTime + .1; step = 0; musicTimer = setInterval(scheduleMusic, 120); scheduleMusic(); }
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(MUSIC_VOL, ctx.currentTime + 2.5);
  }
  function stopMusic() {
    if (!ctx) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + .8);
    clearTimeout(stopAt);
    stopAt = setTimeout(() => { clearInterval(musicTimer); musicTimer = null; }, 900);
  }

  /* ---------- Activar con el primer toque y pausar en segundo plano ---------- */
  async function unlock() {
    if (!init()) return;
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { return; } }
    if (cfg.music && !musicTimer) startMusic();
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume().then(() => { if (cfg.music) startMusic(); });
  });

  /* ---------- Botones de música y efectos ---------- */
  const ICONS = {
    musicOn:  '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    musicOff: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M3 3l18 18"/>',
    sfxOn:    '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    sfxOff:   '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/>'
  };
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  function paint() {
    document.querySelectorAll('.snd-music').forEach(b => {
      b.innerHTML = svg(cfg.music ? ICONS.musicOn : ICONS.musicOff);
      b.setAttribute('aria-pressed', cfg.music); b.setAttribute('aria-label', cfg.music ? 'Apagar música' : 'Encender música');
    });
    document.querySelectorAll('.snd-sfx').forEach(b => {
      b.innerHTML = svg(cfg.sfx ? ICONS.sfxOn : ICONS.sfxOff);
      b.setAttribute('aria-pressed', cfg.sfx); b.setAttribute('aria-label', cfg.sfx ? 'Apagar efectos' : 'Encender efectos');
    });
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest('.snd-music, .snd-sfx'); if (!b) return;
    if (b.classList.contains('snd-music')) { cfg.music = !cfg.music; cfg.music ? startMusic() : stopMusic(); }
    else { cfg.sfx = !cfg.sfx; play('tap'); }
    saveCfg(); paint();
  });
  paint();

  return { play, startMusic, stopMusic, get state() { return { ctx: ctx && ctx.state, music: !!musicTimer, gain: musicBus && musicBus.gain.value }; } };
})();