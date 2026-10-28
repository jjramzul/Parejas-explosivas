'use strict';
/* ====================== Utilidades ====================== */
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuf = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hap = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
let uid = 0;
const svgOf = inner => `<svg class="ic" viewBox="0 0 64 64" aria-hidden="true">${inner.replace(/__U__/g, ++uid)}</svg>`;
const pIcon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

/* ====================== Poderes ====================== */
const POWERS = {
  vision:  { name: 'Visión',   desc: 'Revela cartas al azar por un instante (3 en 4×4, 5 en 6×6).', icon: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>' },
  freeze:  { name: 'Congelar', desc: 'Tu rival pierde su próximo turno.', icon: '<path d="M12 2v20M4.9 7l14.2 10M4.9 17 19.1 7"/><path d="m9.5 4 2.5 2 2.5-2M9.5 20l2.5-2 2.5 2"/>' },
  shuffle: { name: 'Barajar',  desc: 'Mezcla de lugar las cartas sin pareja.', icon: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>' },
  magnet:  { name: 'Imán',     desc: 'Al voltear una carta, ves dónde está su pareja.', icon: '<path d="M5 3v9a7 7 0 0 0 14 0V3"/><path d="M4 7.5h4M16 7.5h4"/>' },
  shield:  { name: 'Escudo',   desc: 'Bloquea el próximo poder de tu rival.', icon: '<path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6l-8-3Z"/><path d="m9 12 2 2 4-4"/>' }
};
const PIDS = Object.keys(POWERS);
/* Memoria de la máquina:
   pRem = probabilidad de recordar una carta que ve
   cap  = cuántas cartas recuerda a la vez (olvida las más viejas)
   use  = probabilidad de aprovechar una pareja que ya conoce
   Simulado contra un jugador con buena memoria: Difícil gana ~59%, Fácil ~25% (4×4) y ~38% (6×6). */
const AI_LEVELS = {
  easy: { pRem: .4, cap: 99, use: .8 },
  hard: { pRem: .7, cap: 8,  use: .92 }
};
const SIZES = {
  '16': { cols: 4, rows: 4, pairs: 8,  vision: 3, label: '4 × 4' },
  '36': { cols: 6, rows: 6, pairs: 18, vision: 5, label: '6 × 6' }
};
const pdesc = (id, G) => id === 'vision' && G ? `Revela ${G.size.vision} cartas al azar por un instante.`
  : id === 'shuffle' && G && G.online ? 'Mezcla las cartas sin pareja. Úsalo en tu turno o en el del rival, antes de que voltee.'
  : POWERS[id].desc;

/* ====================== Temas (SVG animados) ====================== */
const THEMES = (() => {
  const a = 'var(--a)', b = 'var(--b)', c = 'var(--c)', d = 'var(--d)', e = 'var(--e)', k = 'var(--ink)', f = 'var(--f)', g = 'var(--g)';
  const spiralPath = (cx, cy, rmax, turns) => { let s = ''; const n = 60; for (let i = 0; i <= n; i++) { const t = i / n, an = t * turns * Math.PI * 2, r = 1 + t * (rmax - 1); s += (i ? 'L' : 'M') + (cx + r * Math.cos(an)).toFixed(1) + ' ' + (cy + r * Math.sin(an)).toFixed(1); } return s; };
  const galaxy = () => { let s = ''; for (let m = 0; m < 2; m++) for (let t = 0; t < 13; t++) { const an = t * .52 + m * Math.PI, r = 3 + t * 1.95; s += `<circle cx="${(32 + r * Math.cos(an)).toFixed(1)}" cy="${(32 + r * Math.sin(an)).toFixed(1)}" r="${(1.3 + (13 - t) * .22).toFixed(1)}" fill="${m ? a : b}"/>`; } return s; };
  const petals = () => [0, 1, 2, 3, 4, 5].map(i => `<ellipse cx="32" cy="18" rx="7.5" ry="11" fill="${i % 2 ? b : a}" transform="rotate(${i * 60} 32 32)"/>`).join('');

  const ocean = [
    `<g class="fl"><path class="wg or-l" d="M44 32 58 21Q61 32 58 43Z" fill="${b}"/><ellipse cx="29" cy="32" rx="17" ry="11" fill="${a}"/><path d="M27 22Q32 13 38 23Z" fill="${b}"/><path d="M33 22.5Q37.5 32 33 41.5" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="21" cy="29.5" r="3" fill="#fff"/><circle cx="20.3" cy="29.8" r="1.5" fill="${k}"/></g>`,
    `<g class="fl"><g class="sw or-t"><path d="M20 35q-4 8 0 14t0 9M28 35q-3 8 0 14t0 10M36 35q3 8 0 14t0 10M44 35q4 8 0 14t0 9" stroke="${a}" stroke-width="3" fill="none" stroke-linecap="round"/></g><path class="pu or-b" d="M13 36Q13 11 32 11Q51 11 51 36Q42 32 32 36Q22 32 13 36Z" fill="${b}"/><ellipse cx="24" cy="21" rx="6" ry="3.5" fill="#fff" opacity=".55" transform="rotate(-25 24 21)"/><circle cx="26" cy="28" r="1.7" fill="${k}"/><circle cx="38" cy="28" r="1.7" fill="${k}"/></g>`,
    `<g class="sw"><polygon points="32,9 37.9,24.9 54.8,25.6 41.5,36.1 46.1,52.4 32,43 17.9,52.4 22.5,36.1 9.2,25.6 26.1,24.9" fill="${d}" stroke="${d}" stroke-width="5" stroke-linejoin="round"/><g fill="${c}"><circle cx="32" cy="18" r="1.8"/><circle cx="46" cy="28" r="1.8"/><circle cx="41" cy="45" r="1.8"/><circle cx="23" cy="45" r="1.8"/><circle cx="18" cy="28" r="1.8"/></g><circle cx="32" cy="33" r="2.6" fill="${c}"/></g>`,
    `<g class="sw or-b"><path d="M10 44Q8 21 32 12Q56 21 54 44Q32 54 10 44Z" fill="${b}"/><path d="M32 48 14 31M32 48 22 19M32 48V15M32 48 42 19M32 48 50 31" stroke="${a}" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M24 47h16l-3 8H27Z" fill="${a}"/></g>`,
    `<clipPath id="cp__U__"><circle cx="32" cy="32" r="25"/></clipPath><circle cx="32" cy="32" r="25" fill="${c}" opacity=".5"/><g clip-path="url(#cp__U__)"><path class="wv" style="animation-duration:7s" d="M-24 30Q-12 16 0 30T24 30T48 30T72 30T96 30V60H-24Z" fill="${c}"/><path class="wv" style="animation-duration:5s" d="M-24 38Q-12 24 0 38T24 38T48 38T72 38T96 38V60H-24Z" fill="${b}"/><path class="wv" style="animation-duration:3.5s" d="M-24 46Q-12 32 0 46T24 46T48 46T72 46T96 46V64H-24Z" fill="${a}"/></g>`,
    `<g><g class="fl"><circle cx="24" cy="40" r="13" fill="${c}" stroke="${b}" stroke-width="2.5"/><path d="M16 38Q17 31 24 29" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/></g><g class="fl" style="animation-delay:-1.1s"><circle cx="43" cy="24" r="9" fill="${c}" stroke="${b}" stroke-width="2.5"/><path d="M37.5 23Q38 19 42 18" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></g><g class="fl" style="animation-delay:-2s"><circle cx="46" cy="47" r="5.5" fill="${c}" stroke="${b}" stroke-width="2.2"/></g><g class="fl" style="animation-delay:-.5s"><circle cx="18" cy="16" r="4.5" fill="${c}" stroke="${b}" stroke-width="2"/></g></g>`,
    `<g class="sw or-b"><path d="M31 10h2v34h-2Z" fill="${e}"/><path d="M30 13V42H14Z" fill="${c}"/><path d="M35 19V42H51Z" fill="${b}"/><path d="M33 10l9 3.5L33 17Z" fill="${d}"/><path d="M10 44H54L47 54H17Z" fill="${a}"/></g><path d="M8 58q6-4 12 0t12 0 12 0 12 0" stroke="${b}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    `<g class="sw or-b"><path d="M32 56V32M32 46Q21 42 21 28M32 40Q43 36 43 23M32 32V18" stroke="${d}" stroke-width="5" stroke-linecap="round" fill="none"/><g fill="${d}"><circle cx="21" cy="26" r="3.5"/><circle cx="43" cy="21" r="3.5"/><circle cx="32" cy="16" r="3.5"/></g><g fill="${c}"><circle cx="21" cy="26" r="1.2"/><circle cx="43" cy="21" r="1.2"/><circle cx="32" cy="16" r="1.2"/></g></g><path d="M14 58Q32 51 50 58Z" fill="${b}"/>`
  ];
  const forest = [
    `<g class="sw or-b"><path d="M14 51C11 27 28 12 53 11C53 37 40 52 14 51Z" fill="${a}"/><path d="M14 51Q30 35 47 17" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M14 51 7 58" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/><path d="M27 38l9 1M34 30l8 1M22 44l7 1" stroke="${c}" stroke-width="2" stroke-linecap="round" fill="none" opacity=".7"/></g>`,
    `<g class="sw or-b"><rect x="28" y="50" width="8" height="10" rx="2" fill="${d}"/><g stroke-linejoin="round" stroke-width="4"><path d="M32 6 46 26H18Z" fill="${a}" stroke="${a}"/><path d="M32 16 49 38H15Z" fill="${b}" stroke="${b}"/><path d="M32 28 52 52H12Z" fill="${a}" stroke="${a}"/></g></g>`,
    `<g class="pu or-b"><path d="M25 36Q23 54 27 57H37Q41 54 39 36Z" fill="${f}"/><path d="M7 37Q7 9 32 9Q57 9 57 37Z" fill="${d}"/><g fill="#fff" opacity=".92"><circle cx="21" cy="24" r="4.5"/><circle cx="38" cy="19" r="3.5"/><circle cx="46" cy="30" r="4"/><circle cx="30" cy="31" r="2.6"/></g></g>`,
    `<g class="fl"><path d="M18 29Q18 52 32 58Q46 52 46 29Z" fill="${d}"/><path d="M14 31Q14 13 32 13Q50 13 50 31Z" fill="${e}"/><path d="M32 13V6" stroke="${e}" stroke-width="3.5" stroke-linecap="round"/><g fill="${d}" opacity=".55"><circle cx="24" cy="22" r="1.8"/><circle cx="32" cy="19" r="1.8"/><circle cx="40" cy="22" r="1.8"/><circle cx="28" cy="26" r="1.8"/><circle cx="36" cy="26" r="1.8"/></g><path d="M25 38Q27 48 31 52" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".5"/></g>`,
    `<g class="fl"><g transform="translate(64 0) scale(-1 1)"><g class="fp or-r"><path d="M32 31Q6 6 8 28Q10 38 32 35Z" fill="${b}"/><path d="M32 35Q12 38 17 52Q29 54 32 39Z" fill="${d}"/><circle cx="18" cy="24" r="3" fill="${c}"/></g></g><g class="fp or-r"><path d="M32 31Q6 6 8 28Q10 38 32 35Z" fill="${b}"/><path d="M32 35Q12 38 17 52Q29 54 32 39Z" fill="${d}"/><circle cx="18" cy="24" r="3" fill="${c}"/></g><ellipse cx="32" cy="35" rx="2.8" ry="13" fill="${e}"/><path d="M31 22Q28 14 24 12M33 22Q36 14 40 12" stroke="${e}" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`,
    `<g class="fl"><g class="sp"><path d="M50 32H58M44.7 44.7 50.4 50.4M32 50V58M19.3 44.7 13.6 50.4M14 32H6M19.3 19.3 13.6 13.6M32 14V6M44.7 19.3 50.4 13.6" stroke="${d}" stroke-width="4" stroke-linecap="round"/></g><circle cx="32" cy="32" r="13" fill="${d}"/><circle cx="32" cy="32" r="7" fill="#fff" opacity=".35"/></g>`,
    `<g><g class="sp" style="animation-duration:26s">${petals()}</g><circle class="pu" cx="32" cy="32" r="8" fill="${d}"/><circle cx="32" cy="32" r="3.5" fill="#fff" opacity=".45"/></g>`,
    `<g><g class="fl"><path d="M18 38Q8 38 8 29Q8 21 17 21Q20 10 33 11Q45 12 46 22Q56 22 56 30Q56 38 47 38Z" fill="${b}"/><path d="M17 24Q22 16 30 15" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".55"/></g><g fill="${a}"><path class="fall" d="M20 41C20 41 15 47 15 50A5 5 0 0 0 25 50C25 47 20 41 20 41Z"/><path class="fall" style="animation-delay:-.6s" d="M32 43C32 43 27 49 27 52A5 5 0 0 0 37 52C37 49 32 43 32 43Z"/><path class="fall" style="animation-delay:-1.2s" d="M44 41C44 41 39 47 39 50A5 5 0 0 0 49 50C49 47 44 41 44 41Z"/></g></g>`
  ];
  const cosmos = [
    `<g class="fl"><g transform="rotate(-20 32 32)"><path d="M6 32A26 8 0 0 1 58 32" stroke="${d}" stroke-width="4" fill="none" stroke-linecap="round"/></g><circle cx="32" cy="32" r="14" fill="${a}"/><path d="M19 28Q32 22 45 28M18 35Q32 30 46 36" stroke="${b}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/><g transform="rotate(-20 32 32)"><path d="M6 32A26 8 0 0 0 58 32" stroke="${d}" stroke-width="4" fill="none" stroke-linecap="round"/></g></g>`,
    `<g class="sw"><path d="M45 10A24 24 0 1 0 45 54A26 26 0 0 1 45 10Z" fill="${d}"/><circle cx="24" cy="26" r="3" fill="#fff" opacity=".45"/><circle cx="22" cy="40" r="2" fill="#fff" opacity=".45"/></g><g fill="${b}"><path class="tw" d="M51 14l1.5 4 4 1.5-4 1.5L51 25l-1.5-4-4-1.5 4-1.5Z"/><circle class="tw" style="animation-delay:-1s" cx="53" cy="44" r="2.2"/></g>`,
    `<g class="pu"><polygon points="32,8 38.5,24.5 56,25.5 42.5,37 47,54 32,44.5 17,54 21.5,37 8,25.5 25.5,24.5" fill="${d}" stroke="${d}" stroke-width="4" stroke-linejoin="round"/><circle cx="27" cy="24" r="2.5" fill="#fff" opacity=".5"/></g><g fill="${b}"><circle class="tw" cx="10" cy="12" r="2"/><circle class="tw" style="animation-delay:-1.1s" cx="55" cy="10" r="2.2"/></g>`,
    `<g class="fl"><path class="fk or-t" d="M26 45Q32 63 38 45Z" fill="${d}"/><path d="M20 35 9 49 20 45Z" fill="${b}"/><path d="M44 35 55 49 44 45Z" fill="${b}"/><path d="M32 5Q47 17 44 45H20Q17 17 32 5Z" fill="${c}"/><path d="M32 5Q41 11 43.5 24H20.5Q23 11 32 5Z" fill="${a}"/><circle cx="32" cy="32" r="5.5" fill="${e}"/><circle cx="32" cy="32" r="3.5" fill="${b}"/></g>`,
    `<g class="dr2"><path d="M42 18Q16 22 5 53Q24 38 50 27Z" fill="${b}" opacity=".85"/><path d="M42 21Q24 28 14 46Q29 36 46 28Z" fill="${c}"/><circle cx="46" cy="22" r="10" fill="${d}"/><circle cx="43" cy="19" r="3.5" fill="#fff" opacity=".5"/></g><g fill="${a}"><circle class="tw" cx="14" cy="14" r="2"/><circle class="tw" style="animation-delay:-.8s" cx="54" cy="50" r="2.2"/></g>`,
    `<g><g class="sp" style="animation-duration:18s">${galaxy()}</g><circle class="pu" cx="32" cy="32" r="5" fill="${d}"/></g>`,
    `<g class="fl"><path class="pu or-t" d="M23 41 15 58H49L41 41Z" fill="${d}" opacity=".3"/><path d="M21 28Q21 12 32 12Q43 12 43 28Z" fill="${b}"/><path d="M26 22Q28 17 32 16" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".6"/><ellipse cx="32" cy="32" rx="26" ry="9" fill="${a}"/><g fill="${d}"><circle class="tw" cx="17" cy="33" r="2.4"/><circle class="tw" style="animation-delay:-.7s" cx="32" cy="36" r="2.4"/><circle class="tw" style="animation-delay:-1.4s" cx="47" cy="33" r="2.4"/></g></g>`,
    `<g class="fl"><rect x="25" y="52" width="14" height="6" rx="2" fill="${a}"/><circle cx="32" cy="30" r="22" fill="${c}" stroke="${b}" stroke-width="2.5"/><rect x="15" y="20" width="34" height="23" rx="11.5" fill="${e}"/><path class="tw" d="M21 28Q23 24 28 24" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="9" cy="30" r="3" fill="${b}"/><circle cx="55" cy="30" r="3" fill="${b}"/></g>`
  ];
  const sweet = [
    `<g class="fl"><path d="M20 35 32 61 44 35Z" fill="${d}"/><path d="M24 40H36M26.5 46H37.5M29 52H35" stroke="${e}" stroke-width="1.8" opacity=".4" stroke-linecap="round" fill="none"/><path d="M16 37Q15 24 32 24Q49 24 48 37Q44 42 40 38Q36 43 32 38Q28 43 24 38Q20 42 16 37Z" fill="${a}"/><circle cx="32" cy="19" r="10" fill="${b}"/><circle cx="32" cy="8" r="3.4" fill="${e}"/><path d="M24 29Q25 26 28 25" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".55"/></g>`,
    `<g class="pu or-b"><path d="M14 38H50L45 58H19Z" fill="${d}"/><path d="M22 41 24 55M32 41V55M42 41 40 55" stroke="${e}" stroke-width="1.8" opacity=".35" stroke-linecap="round"/><path d="M11 39Q8 26 21 27Q20 15 32 14Q44 15 43 27Q56 26 53 39Z" fill="${a}"/><circle cx="32" cy="10" r="4" fill="${e}"/><g stroke-linecap="round" stroke-width="2.6"><path d="M22 32l3-2" stroke="#fff"/><path d="M34 24l3 2" stroke="${c}"/><path d="M42 33l3-1" stroke="#fff"/><path d="M28 36h3" stroke="${c}"/></g></g>`,
    `<g class="fl"><rect x="30" y="38" width="4" height="22" rx="2" fill="${f}"/><circle cx="32" cy="26" r="18" fill="${b}"/><g class="sp" style="transform-origin:32px 26px;transform-box:view-box"><path d="${spiralPath(32, 26, 14, 2.6)}" stroke="${a}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>`,
    `<g class="sp" style="animation-duration:32s"><path fill-rule="evenodd" d="M32 11A21 21 0 1 0 32.01 11ZM32 25A7 7 0 1 1 31.99 25Z" fill="${d}"/><path fill-rule="evenodd" d="M32 14A18 18 0 1 0 32.01 14ZM32 24.5A7.5 7.5 0 1 1 31.99 24.5Z" fill="${a}"/><g stroke-linecap="round" stroke-width="2.6"><path d="M20 22l3 2" stroke="#fff"/><path d="M40 17l2 3" stroke="${c}"/><path d="M47 33l3 1" stroke="${d}"/><path d="M38 47l2-3" stroke="#fff"/><path d="M19 40l3-1" stroke="${c}"/><path d="M30 18l1 3" stroke="${d}"/></g></g>`,
    `<g class="bt"><path d="M32 56C8 41 6 23 17 16C25 12 32 18 32 23C32 18 39 12 47 16C58 23 56 41 32 56Z" fill="${a}"/><ellipse cx="20" cy="24" rx="4" ry="2.4" fill="#fff" opacity=".5" transform="rotate(-35 20 24)"/></g>`,
    `<g class="fl"><path d="M11 30Q11 14 32 14Q53 14 53 30Z" fill="${b}"/><path d="M19 22Q22 18 27 17" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".6"/><rect x="9" y="29" width="46" height="7" rx="3.5" fill="${d}"/><path d="M11 35Q11 50 32 50Q53 50 53 35Z" fill="${b}"/></g>`,
    `<g class="sw"><path d="M18 32 5 21V43Z" fill="${b}"/><path d="M46 32 59 21V43Z" fill="${b}"/><ellipse cx="32" cy="32" rx="15" ry="12" fill="${a}"/><path d="M25 23Q34 32 25 41" stroke="${c}" stroke-width="3.2" fill="none" stroke-linecap="round"/><ellipse cx="26" cy="27" rx="4" ry="2" fill="#fff" opacity=".5" transform="rotate(-30 26 27)"/></g>`,
    `<g class="sw or-t"><path d="M32 59C11 47 9 27 15 22C22 17 27 22 32 22C37 22 42 17 49 22C55 27 53 47 32 59Z" fill="${a}"/><g fill="#fff" opacity=".85"><ellipse cx="24" cy="31" rx="1.5" ry="2.2"/><ellipse cx="40" cy="31" rx="1.5" ry="2.2"/><ellipse cx="32" cy="36" rx="1.5" ry="2.2"/><ellipse cx="27" cy="43" rx="1.5" ry="2.2"/><ellipse cx="37" cy="43" rx="1.5" ry="2.2"/><ellipse cx="32" cy="50" rx="1.5" ry="2.2"/></g><path d="M32 23 21 15 28 21 25 11 32 18 39 11 36 21 43 15Z" fill="${g}" stroke="${g}" stroke-width="2" stroke-linejoin="round"/></g>`
  ];
  /* ---- 10 ilustraciones extra por tema (para tableros 4×5 y 6×6) ---- */
  const eye = (x, y, r = 2.6, p = 1.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + .4}" cy="${y + .3}" r="${p}" fill="${k}"/>`;
  const choc = '#8B5A3C', chocD = '#6E4329';
  ocean.push(
    // tortuga
    `<g class="fl"><g fill="${b}"><g class="wg"><ellipse cx="18" cy="23" rx="6.5" ry="3.8"/></g><g class="wg" style="animation-delay:-.9s"><ellipse cx="18" cy="45" rx="6.5" ry="3.8"/></g><g class="wg" style="animation-delay:-.4s"><ellipse cx="44" cy="22" rx="5.5" ry="3.3"/></g><g class="wg" style="animation-delay:-1.3s"><ellipse cx="44" cy="46" rx="5.5" ry="3.3"/></g><circle cx="53" cy="34" r="6.5"/><path d="M15 34 8 31V37Z"/></g><ellipse cx="32" cy="34" rx="17" ry="14" fill="${a}"/><path d="M27 28h10l4 6-4 6H27l-4-6Z" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round"/><path d="M27 28 22 22M37 28l5-6M27 40l-5 6M37 40l5 6M23 34h-6M41 34h6" stroke="${c}" stroke-width="2" stroke-linecap="round"/><circle cx="55.5" cy="32" r="1.5" fill="${k}"/></g>`,
    // pulpo
    `<g class="fl"><g class="sw or-t" fill="none" stroke="${a}" stroke-width="4.5" stroke-linecap="round"><path d="M19 33q-4 10-9 12M26 34q-2 12-6 18M32 34v20M38 34q2 12 6 18M45 33q4 10 9 12"/></g><path d="M15 35Q15 11 32 11Q49 11 49 35Z" fill="${a}"/><circle cx="22" cy="17" r="2.5" fill="${b}"/><circle cx="41" cy="16" r="2" fill="${b}"/>${eye(26, 26)}${eye(38, 26)}<path d="M29 31q3 2 6 0" stroke="${k}" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`,
    // ballena
    `<g class="fl"><g class="pu or-b"><path d="M24 20q0-6-5-9M24 20q0-6 5-9M24 20V9" stroke="${b}" stroke-width="2.6" fill="none" stroke-linecap="round"/></g><path d="M7 38Q7 22 28 22Q43 22 49 34L58 25Q61 34 57 40Q51 51 30 51Q7 51 7 38Z" fill="${e}"/><path d="M11 42Q20 48 32 47Q42 46 48 42" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/>${eye(18, 34, 2.2, 1.2)}</g>`,
    // cangrejo
    `<g class="fl"><g class="wg or-b"><path d="M15 31Q6 23 12 13Q14 20 19 20Q16 14 20 10Q27 18 21 31Z" fill="${d}"/></g><g class="wg or-b" style="animation-delay:-.9s"><path d="M49 31Q58 23 52 13Q50 20 45 20Q48 14 44 10Q37 18 43 31Z" fill="${d}"/></g><path d="M19 41l-9 4M19 46l-7 8M45 41l9 4M45 46l7 8" stroke="${d}" stroke-width="3" stroke-linecap="round"/><ellipse cx="32" cy="41" rx="15" ry="10" fill="${d}"/><path d="M27 32v-6M37 32v-6" stroke="${d}" stroke-width="2.6"/>${eye(27, 24, 3, 1.5)}${eye(37, 24, 3, 1.5)}</g>`,
    // ancla
    `<g class="sw or-t"><circle cx="32" cy="12" r="5" fill="none" stroke="${e}" stroke-width="3.5"/><path d="M32 17V54M22 26H42M12 38Q14 54 32 54Q50 54 52 38" stroke="${e}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M7 41l5-8 5 8ZM47 41l5-8 5 8Z" fill="${e}"/></g>`,
    // faro
    `<path class="tw" d="M39 17 60 9V27Z" fill="${d}" opacity=".5"/><path d="M23 56 27 22H37L41 56Z" fill="${c}"/><path d="M25.8 32H38.2L39.2 40H24.8ZM24 48H40L41 56H23Z" fill="${a}"/><rect x="25" y="14" width="14" height="8" rx="1" fill="${e}"/><rect class="tw" x="28.5" y="15.5" width="7" height="5" fill="${d}"/><path d="M23.5 14Q32 3 40.5 14Z" fill="${a}"/><path d="M12 58Q32 51 52 58Z" fill="${b}"/>`,
    // delfín
    `<g class="sw"><path d="M30 19 35 8 41 20Z" fill="${b}"/><path d="M9 42Q16 19 40 18Q51 18 57 26Q51 26 47 28Q49 37 40 44Q36 40 30 42Q22 45 18 51Q16 45 9 42Z" fill="${b}"/><path d="M22 36Q32 28 44 30" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/><circle cx="46" cy="23" r="1.7" fill="${k}"/></g>`,
    // ostra con perla
    `<g class="pu or-b"><path d="M8 38Q32 30 56 38Q50 55 32 55Q14 55 8 38Z" fill="${b}"/><path d="M8 36Q12 13 32 13Q52 13 56 36Q32 28 8 36Z" fill="${a}"/><path d="M20 30 24 17M32 28V14M44 30 40 17" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity=".7"/><circle cx="32" cy="40" r="6.5" fill="#fff" stroke="${c}" stroke-width="2"/><circle cx="30" cy="38" r="1.8" fill="${c}"/></g>`,
    // alga
    `<g class="sw or-b"><path d="M24 58Q17 48 24 38Q31 28 24 18Q21 12 26 7" stroke="${g}" stroke-width="5" fill="none" stroke-linecap="round"/></g><g class="sw or-b" style="animation-delay:-1.6s"><path d="M39 58Q46 48 39 40Q32 32 39 22" stroke="${g}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/></g><path d="M12 58Q32 51 52 58Z" fill="${d}" opacity=".55"/>`,
    // pez globo
    `<g class="pu"><g stroke="${d}" stroke-width="2.6" stroke-linecap="round"><path d="M32 13V7M44 16l3-4M20 16l-3-4M50 27l5-2M15 27l-5-2M48 44l4 3M17 44l-4 3M32 51v6"/></g><path d="M15 32 6 25V39Z" fill="${d}"/><circle cx="32" cy="32" r="18" fill="${d}"/><path d="M18 38Q32 50 46 38" fill="${c}"/>${eye(40, 27, 3.4, 1.8)}<path d="M47 34q2 1 0 2" stroke="${k}" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`
  );
  forest.push(
    // búho
    `<g class="fl"><path d="M16 22 19 9 27 17Q32 15 37 17L45 9 48 22Q52 30 50 42Q46 56 32 56Q18 56 14 42Q12 30 16 22Z" fill="${e}"/><ellipse cx="32" cy="43" rx="10" ry="11" fill="${f}"/><path d="M27 41q2 2 4 0M33 45q2 2 4 0M28 49q2 2 4 0" stroke="${d}" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="25" cy="28" r="7" fill="#fff"/><circle cx="39" cy="28" r="7" fill="#fff"/><g class="bt"><circle cx="25" cy="28" r="3.3" fill="${k}"/></g><g class="bt" style="animation-delay:-.2s"><circle cx="39" cy="28" r="3.3" fill="${k}"/></g><path d="M29.5 34h5L32 38.5Z" fill="${d}"/></g>`,
    // caracol
    `<g class="fl"><path d="M9 50H48Q55 50 55 42V33" stroke="${b}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M54 32l-3-9M57 32l3-9" stroke="${b}" stroke-width="2.2" stroke-linecap="round"/><circle cx="51" cy="22" r="2.2" fill="${a}"/><circle cx="60" cy="22" r="2.2" fill="${a}"/><circle cx="28" cy="34" r="15" fill="${d}"/><g class="sp" style="transform-origin:28px 34px;transform-box:view-box;animation-duration:18s"><path d="${spiralPath(28, 34, 12, 2.3)}" stroke="${e}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/></g></g>`,
    // montaña
    `<path d="M3 55 24 19 35 36 43 26 61 55Z" fill="${a}"/><path d="M43 26 61 55H40Z" fill="${b}" opacity=".6"/><path d="M24 19 18 29 22 27 26 31 30 28Z" fill="#fff"/><path d="M43 26 39 32 43 31 47 32Z" fill="#fff"/><g class="dr2"><path d="M8 18Q8 13 13 13Q15 9 20 10Q25 10 25 15Q29 15 29 18Q29 21 25 21H11Q8 21 8 18Z" fill="${c}"/></g>`,
    // tulipán
    `<g class="sw or-b"><path d="M32 59V30" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/><path d="M32 51Q19 49 17 36Q30 38 32 49Z" fill="${b}"/><path d="M32 46Q43 44 46 33Q35 35 32 44Z" fill="${a}"/><path d="M20 13 26 20 32 9 38 20 44 13Q47 33 32 35Q17 33 20 13Z" fill="${d}"/><path d="M25 22Q25 29 30 32" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".5"/></g>`,
    // trébol
    `<g class="sw or-b"><path d="M32 34Q34 48 44 58" stroke="${a}" stroke-width="3.5" fill="none" stroke-linecap="round"/><g fill="${a}"><path d="M32 32C24 30 16 24 20 16C24 9 32 14 32 20C32 14 40 9 44 16C48 24 40 30 32 32Z"/></g><path d="M31 33C27 41 19 47 14 41C9 35 16 30 21 32C16 29 18 21 26 24C32 26 33 30 31 33Z" fill="${b}"/><path d="M33 33C37 41 45 47 50 41C55 35 48 30 43 32C48 29 46 21 38 24C32 26 31 30 33 33Z" fill="${g}"/></g>`,
    // arcoíris
    `<g class="pu or-b"><path d="M8 46A24 24 0 0 1 56 46" stroke="${d}" stroke-width="6" fill="none"/><path d="M15 46A17 17 0 0 1 49 46" stroke="${b}" stroke-width="6" fill="none"/><path d="M22 46A10 10 0 0 1 42 46" stroke="${a}" stroke-width="6" fill="none"/><path d="M2 50Q2 44 8 44Q10 40 15 41Q19 42 19 46Q22 47 21 50Z" fill="${c}"/><path d="M43 50Q43 44 49 44Q51 40 56 41Q60 42 60 46Q63 47 62 50Z" fill="${c}"/></g>`,
    // manzana
    `<g class="sw or-t"><path d="M32 20Q22 12 14 22Q8 34 16 46Q24 58 32 52Q40 58 48 46Q56 34 50 22Q42 12 32 20Z" fill="${a}"/><path d="M32 20Q32 12 36 7" stroke="${e}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M35 13Q42 5 49 11Q41 18 35 13Z" fill="${b}"/><path d="M19 28Q17 34 19 40" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/></g>`,
    // abeja
    `<g class="fl"><g class="fp or-b" style="animation-duration:.5s"><ellipse cx="26" cy="21" rx="7" ry="10" fill="${c}" stroke="${b}" stroke-width="2"/></g><g class="fp or-b" style="animation-duration:.5s;animation-delay:-.25s"><ellipse cx="38" cy="21" rx="7" ry="10" fill="${c}" stroke="${b}" stroke-width="2"/></g><path d="M46 38h7" stroke="${e}" stroke-width="3" stroke-linecap="round"/><ellipse cx="32" cy="38" rx="15" ry="11" fill="${d}"/><path d="M28 27.5v21M36 27.5v21" stroke="${e}" stroke-width="4"/><circle cx="21" cy="35" r="1.9" fill="${k}"/><path d="M19 40q2 2 4 0" stroke="${k}" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`,
    // fogata
    `<path d="M13 55 51 46M13 46 51 55" stroke="${e}" stroke-width="5.5" stroke-linecap="round"/><g class="fk or-b"><path d="M32 10Q45 25 43 38Q41 49 32 49Q23 49 21 38Q19 27 32 10Z" fill="${d}"/><path d="M32 27Q39 35 37 42Q35 47 32 47Q28 47 27 42Q26 35 32 27Z" fill="#FFD27A"/></g>`,
    // cabaña
    `<g class="pu or-b"><rect x="39" y="12" width="7" height="14" fill="${e}"/><rect x="14" y="30" width="36" height="25" rx="1" fill="${e}"/><path d="M14 36H50M14 43H50M14 50H50" stroke="${f}" stroke-width="1.2" opacity=".35"/><path d="M8 32 32 12 56 32Z" fill="${a}" stroke="${a}" stroke-width="3" stroke-linejoin="round"/><rect x="28" y="41" width="9" height="14" rx="1" fill="${f}"/><rect x="18" y="37" width="7" height="7" rx="1" fill="${d}"/></g><circle class="tw" cx="44" cy="7" r="2.6" fill="${c}"/><circle class="tw" style="animation-delay:-1s" cx="49" cy="4" r="2" fill="${c}"/>`
  );
  cosmos.push(
    // satélite
    `<g class="sw"><rect x="3" y="26" width="19" height="12" rx="2" fill="${b}"/><rect x="42" y="26" width="19" height="12" rx="2" fill="${b}"/><path d="M9.5 26v12M15.5 26v12M48.5 26v12M54.5 26v12" stroke="${c}" stroke-width="1.6"/><path d="M22 32h20" stroke="${e}" stroke-width="2.5"/><rect x="25" y="22" width="14" height="20" rx="3" fill="${a}"/><path d="M32 22V14" stroke="${e}" stroke-width="2"/><circle class="tw" cx="32" cy="12" r="2.8" fill="${d}"/></g>`,
    // telescopio
    `<path d="M32 36 21 58M32 36 43 58M32 36V58" stroke="${e}" stroke-width="3" stroke-linecap="round"/><g class="sw"><path d="M11 35 43 14 49 24 17 45Z" fill="${a}"/><path d="M43 14 49 24 54 21 48 11Z" fill="${b}"/><path d="M15 38 41 21" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".4"/></g><path class="tw" d="M56 4l1.3 3.2 3.2 1.3-3.2 1.3L56 13l-1.3-3.2-3.2-1.3 3.2-1.3Z" fill="${d}"/>`,
    // Tierra
    `<clipPath id="ce__U__"><circle cx="32" cy="32" r="20"/></clipPath><circle cx="32" cy="32" r="20" fill="#5AA9F0"/><g clip-path="url(#ce__U__)"><g class="wv" style="animation-duration:9s"><path d="M10 20q7-5 11 2t-2 10-6 6M36 16q8 2 6 10t6 9M18 46q8-3 13 4M58 20q7-5 11 2t-2 10-6 6M84 16q8 2 6 10t6 9M66 46q8-3 13 4" stroke="${g}" stroke-width="7" stroke-linecap="round" fill="none"/></g></g><circle cx="32" cy="32" r="20" fill="none" stroke="${c}" stroke-width="2"/>`,
    // alien
    `<g class="fl"><path d="M23 14 18 6M41 14 46 6" stroke="${g}" stroke-width="2.5" stroke-linecap="round"/><circle class="tw" cx="18" cy="6" r="2.8" fill="${g}"/><circle class="tw" style="animation-delay:-1s" cx="46" cy="6" r="2.8" fill="${g}"/><path d="M32 12Q52 12 52 30Q52 48 32 56Q12 48 12 30Q12 12 32 12Z" fill="${g}"/><ellipse cx="24" cy="32" rx="5.5" ry="7.5" fill="${e}"/><ellipse cx="40" cy="32" rx="5.5" ry="7.5" fill="${e}"/><circle cx="22.5" cy="29" r="1.8" fill="#fff"/><circle cx="38.5" cy="29" r="1.8" fill="#fff"/><path d="M28 46q4 3 8 0" stroke="${e}" stroke-width="2" fill="none" stroke-linecap="round"/></g>`,
    // asteroide
    `<g class="sp" style="animation-duration:22s"><path d="M20 13 38 9 53 19 55 38 45 53 24 55 11 43 9 26Z" fill="${b}" stroke="${b}" stroke-width="3" stroke-linejoin="round"/><circle cx="26" cy="25" r="5" fill="${a}" opacity=".45"/><circle cx="40" cy="38" r="7" fill="${a}" opacity=".45"/><circle cx="23" cy="42" r="3" fill="${a}" opacity=".45"/><circle cx="42" cy="21" r="2.5" fill="${a}" opacity=".45"/></g>`,
    // constelación
    `<path d="M9 45 21 30 34 37 46 17 56 27" stroke="${b}" stroke-width="2" fill="none" stroke-dasharray="3 3" stroke-linecap="round"/><g fill="${d}"><circle class="tw" cx="9" cy="45" r="3.4"/><circle class="tw" style="animation-delay:-.4s" cx="21" cy="30" r="3"/><circle class="tw" style="animation-delay:-.9s" cx="34" cy="37" r="3.6"/><circle class="tw" style="animation-delay:-1.3s" cx="46" cy="17" r="3.2"/><circle class="tw" style="animation-delay:-1.8s" cx="56" cy="27" r="2.8"/></g><circle cx="40" cy="52" r="1.6" fill="${b}"/><circle cx="14" cy="16" r="1.4" fill="${b}"/>`,
    // agujero negro
    `<g class="sp" style="animation-duration:10s"><circle cx="32" cy="32" r="23" fill="none" stroke="${b}" stroke-width="3" stroke-dasharray="10 6" stroke-linecap="round"/></g><g class="sp" style="animation-duration:5s;animation-direction:reverse"><circle cx="32" cy="32" r="16" fill="none" stroke="${d}" stroke-width="3.5" stroke-dasharray="8 5" stroke-linecap="round"/></g><circle cx="32" cy="32" r="10" fill="${e}"/>`,
    // Marte
    `<g class="fl"><circle cx="32" cy="32" r="20" fill="#F08A5D"/><circle cx="25" cy="25" r="4.2" fill="#D96B3E"/><circle cx="39" cy="38" r="6" fill="#D96B3E"/><circle cx="23" cy="42" r="2.6" fill="#D96B3E"/><circle cx="42" cy="22" r="2" fill="#D96B3E"/><path d="M18 22Q24 14 32 13" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".45"/></g><circle class="tw" cx="55" cy="11" r="2.2" fill="${b}"/><circle class="tw" style="animation-delay:-1.2s" cx="8" cy="52" r="1.8" fill="${b}"/>`,
    // bandera lunar
    `<path d="M3 57Q32 37 61 57Z" fill="${c}"/><circle cx="18" cy="53" r="2.2" fill="${b}"/><circle cx="45" cy="50" r="2.8" fill="${b}"/><path d="M28 47V11" stroke="${e}" stroke-width="2.6" stroke-linecap="round"/><g class="sw or-l"><path d="M29 12Q39 9 48 13Q46 20 48 26Q39 22 29 25Z" fill="${a}"/></g><circle class="tw" cx="54" cy="38" r="2" fill="${d}"/><circle class="tw" style="animation-delay:-1s" cx="12" cy="20" r="1.8" fill="${d}"/>`,
    // eclipse
    `<circle class="pu" cx="32" cy="32" r="22" fill="${d}" opacity=".3"/><circle cx="32" cy="32" r="16" fill="${d}"/><g class="dr2"><circle cx="35" cy="30" r="14.5" fill="${e}"/></g>`
  );
  sweet.push(
    // galleta
    `<g class="sp" style="animation-duration:24s"><circle cx="32" cy="32" r="21" fill="${d}"/><path d="M14 26Q16 18 22 14" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".4"/><g fill="${choc}"><circle cx="24" cy="24" r="3"/><circle cx="38" cy="21" r="2.6"/><circle cx="43" cy="36" r="3.2"/><circle cx="28" cy="41" r="3.3"/><circle cx="19" cy="34" r="2.2"/><circle cx="34" cy="31" r="2.2"/><circle cx="37" cy="46" r="1.8"/></g></g>`,
    // pastel con vela
    `<g class="pu or-b"><rect x="12" y="30" width="40" height="25" rx="4" fill="${f}"/><rect x="12" y="40" width="40" height="5" fill="${a}"/><path d="M12 34Q12 26 20 26H44Q52 26 52 34Q48 38 44 34Q40 38 36 34Q32 38 28 34Q24 38 20 34Q16 38 12 34Z" fill="${b}"/><rect x="30" y="13" width="4" height="13" rx="1.5" fill="${c}" stroke="${e}" stroke-width="1"/><path class="fk or-b" d="M32 4Q36.5 9 32 12.5Q27.5 9 32 4Z" fill="${d}"/></g>`,
    // chocolate
    `<g class="sw"><rect x="16" y="7" width="32" height="34" rx="3" fill="${choc}"/><path d="M32 7v34M16 18h32M16 29h32" stroke="${chocD}" stroke-width="2"/><path d="M14 35H50V57H14Z" fill="${a}"/><path d="M14 35l4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4" stroke="${b}" stroke-width="2.2" fill="none" stroke-linejoin="round"/><path d="M24 46h16" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".6"/></g>`,
    // paleta helada
    `<g class="sw or-b"><rect x="29" y="40" width="6" height="19" rx="3" fill="${d}"/><path d="M18 18Q18 7 32 7Q46 7 46 18V44H18Z" fill="${b}"/><path d="M18 30H46V44H18Z" fill="${a}"/><path d="M24 13V26" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/></g>`,
    // cerezas
    `<g class="sw or-t"><path d="M21 40Q25 22 40 10M43 40Q40 24 40 10" stroke="${g}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M40 10Q48 5 53 12Q46 16 40 10Z" fill="${g}"/><circle cx="21" cy="45" r="10" fill="${e}"/><circle cx="43" cy="45" r="10" fill="${e}"/><circle cx="17.5" cy="41" r="2.6" fill="#fff" opacity=".5"/><circle cx="39.5" cy="41" r="2.6" fill="#fff" opacity=".5"/></g>`,
    // osito de goma
    `<g class="bt"><g fill="${g}"><circle cx="22" cy="13" r="5"/><circle cx="42" cy="13" r="5"/><circle cx="32" cy="22" r="11"/><ellipse cx="32" cy="44" rx="13" ry="13"/><circle cx="18" cy="38" r="5"/><circle cx="46" cy="38" r="5"/><circle cx="23" cy="56" r="5.5"/><circle cx="41" cy="56" r="5.5"/></g><circle cx="28" cy="20" r="1.6" fill="${k}"/><circle cx="36" cy="20" r="1.6" fill="${k}"/><ellipse cx="32" cy="25.5" rx="2.4" ry="1.6" fill="${k}"/><ellipse cx="27" cy="41" rx="3" ry="4.5" fill="#fff" opacity=".35"/></g>`,
    // flan
    `<g class="pu or-b"><ellipse cx="32" cy="52" rx="25" ry="4.5" fill="${b}"/><path d="M14 51 20 22H44L50 51Z" fill="${d}"/><path d="M20 22H44L42.5 30Q39 34 36 30Q33 35 30 30Q26 34 21.5 30Z" fill="${choc}"/><path d="M21 38 19 47" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".45"/><circle cx="32" cy="16" r="5" fill="${e}"/></g>`,
    // bastón de caramelo
    `<g class="sw or-b"><path d="M27 58V22Q27 9 38 9Q49 9 49 20" stroke="${b}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M27 58V22Q27 9 38 9Q49 9 49 20" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M27 58V22Q27 9 38 9Q49 9 49 20" stroke="${a}" stroke-width="8" fill="none" stroke-dasharray="6 6"/></g>`,
    // malteada
    `<g class="fl"><path d="M41 5 35 26" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/><path d="M14 27Q13 17 23 18Q27 10 35 13Q46 11 50 27Z" fill="${f}" stroke="${d}" stroke-width="1.2"/><path d="M14 27H50L44 58H20Z" fill="${b}"/><path d="M17 36H47M19 46H45" stroke="#fff" stroke-width="2.5" opacity=".6"/><circle cx="27" cy="14" r="4.2" fill="${e}"/></g>`,
    // taza de chocolate caliente
    `<g fill="none" stroke="${b}" stroke-width="2.6" stroke-linecap="round"><path class="tw" d="M24 21q-3-5 0-9t0-8"/><path class="tw" style="animation-delay:-.7s" d="M32 21q-3-5 0-9t0-8"/><path class="tw" style="animation-delay:-1.4s" d="M40 21q-3-5 0-9t0-8"/></g><path d="M46 32Q57 31 55 40Q53 47 45 45" stroke="${a}" stroke-width="4.5" fill="none"/><path d="M13 27H47V43Q47 55 30 55Q13 55 13 43Z" fill="${a}"/><ellipse cx="30" cy="27" rx="17" ry="4" fill="${choc}"/><path d="M19 34V44" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>`
  );
  return [
    { id: 'ocean',  name: 'Océano', a: '#2F80ED', b: '#56CCF2', c: '#BFE9FB', d: '#FFA94D', e: '#1B4F9C', ui: '#1D6FDB', icons: ocean,  names: ['pez', 'medusa', 'estrella de mar', 'concha', 'ola', 'burbujas', 'velero', 'coral', 'tortuga', 'pulpo', 'ballena', 'cangrejo', 'ancla', 'faro', 'delfín', 'ostra', 'alga', 'pez globo'] },
    { id: 'forest', name: 'Bosque', a: '#2E9E5B', b: '#8BD17C', c: '#D5F0C8', d: '#F0974A', e: '#8A5A3B', ui: '#1A7F45', icons: forest, names: ['hoja', 'pino', 'hongo', 'bellota', 'mariposa', 'sol', 'flor', 'lluvia', 'búho', 'caracol', 'montaña', 'tulipán', 'trébol', 'arcoíris', 'manzana', 'abeja', 'fogata', 'cabaña'] },
    { id: 'cosmos', name: 'Cosmos', a: '#6C5CE7', b: '#A29BFE', c: '#E0DCFF', d: '#FFC83D', e: '#2D2A6E', ui: '#6C5CE7', icons: cosmos, names: ['planeta', 'luna', 'estrella', 'cohete', 'cometa', 'galaxia', 'ovni', 'casco', 'satélite', 'telescopio', 'Tierra', 'alien', 'asteroide', 'constelación', 'agujero negro', 'Marte', 'bandera', 'eclipse'] },
    { id: 'sweet',  name: 'Dulce',  a: '#FF6B9D', b: '#FFA8C5', c: '#FFE0EA', d: '#F4B26B', e: '#B8456B', ui: '#C92F64', icons: sweet,  names: ['helado', 'cupcake', 'piruleta', 'dona', 'corazón', 'macaron', 'caramelo', 'fresa', 'galleta', 'pastel', 'chocolate', 'paleta', 'cerezas', 'osito de goma', 'flan', 'bastón de caramelo', 'malteada', 'chocolate caliente'] }
  ];
})();
const themeVars = t => `--a:${t.a};--b:${t.b};--c:${t.c};--d:${t.d};--e:${t.e};--ui:${t.ui}`;

/* ====================== Configuración (menú) ====================== */
let cfg = { mode: 'ai', diff: 'hard', theme: 'ocean', powerMode: 'random', picked: [], size: '16' };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('pcp-cfg') || '{}')); } catch (e) {}
if (!SIZES[cfg.size]) cfg.size = '16';
if (!THEMES.some(t => t.id === cfg.theme)) cfg.theme = 'ocean';
cfg.picked = (cfg.picked || []).filter(p => PIDS.includes(p)).slice(0, 3);
const saveCfg = () => { try { localStorage.setItem('pcp-cfg', JSON.stringify(cfg)); } catch (e) {} };

function seg(el, opts, get, set) {
  el.className = 'seg'; el.setAttribute('role', 'radiogroup'); el.style.setProperty('--n', opts.length);
  el.innerHTML = '<i class="thumb"></i>' + opts.map(([v, l]) => `<button role="radio" data-v="${v}">${l}</button>`).join('');
  const paint = () => { el.style.setProperty('--i', Math.max(0, opts.findIndex(o => o[0] === get()))); el.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.v === get())); };
  el.onclick = ev => { const bt = ev.target.closest('button'); if (!bt) return; set(bt.dataset.v); paint(); Sfx.play('tap'); };
  paint();
}
const theme = () => THEMES.find(t => t.id === cfg.theme);
function applyTheme() {
  const t = theme(), r = document.documentElement.style;
  ['a', 'b', 'c', 'd', 'e', 'ui'].forEach(k => r.setProperty('--' + k, t[k]));
  $('#hero').innerHTML = [0, 3, 5].map((i, n) => `<div class="mini" style="--r:${[-9, 0, 9][n]}deg"><div class="mf">${svgOf(t.icons[i])}</div></div>`).join('');
  document.querySelectorAll('.tile').forEach(x => x.setAttribute('aria-pressed', x.dataset.t === cfg.theme));
}
function renderPowers() {
  const pick = cfg.powerMode === 'pick';
  $('#plist').innerHTML = PIDS.map(id => {
    const p = POWERS[id], on = cfg.picked.includes(id), full = cfg.picked.length >= 3 && !on;
    const inner = `<span class="pi">${pIcon(p.icon)}</span><span class="pt"><b>${p.name}</b><small>${p.desc}</small></span>` +
      (pick ? `<span class="ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>` : '');
    return pick ? `<button class="prow${full ? ' dim' : ''}" data-p="${id}" aria-pressed="${on}">${inner}</button>` : `<div class="prow" title="${p.desc}">${inner}</div>`;
  }).join('');
  $('#plist').classList.toggle('compact', !pick);
  $('#pcount').textContent = pick ? `· ${cfg.picked.length}/3` : '';
  $('#pnote').textContent = pick ? (cfg.picked.length ? 'Máximo 3 por partida. Cada jugador usa cada poder una sola vez.' : 'Elige de 1 a 3 poderes para esta partida.') : 'Se sortean 3 de los 5 al empezar. Cada jugador usa cada poder una sola vez.';
  $('#play').disabled = pick && cfg.picked.length === 0;
}
function paintMode() {
  const on = cfg.mode === 'online';
  $('#diffWrap').hidden = cfg.mode !== 'ai';
  $('#play').textContent = on ? 'Crear sala' : 'Jugar';
  $('#join').hidden = !on;
  $('#onlineNote').hidden = !on;
}
function initHome() {
  seg($('#segMode'), [['pvp', '2 jugadores'], ['ai', 'Máquina'], ['online', 'En línea']], () => cfg.mode, v => { cfg.mode = v; paintMode(); saveCfg(); });
  seg($('#segDiff'), [['easy', 'Fácil'], ['hard', 'Difícil']], () => cfg.diff, v => { cfg.diff = v; saveCfg(); });
  seg($('#segPow'), [['random', 'Aleatorios'], ['pick', 'Elegir']], () => cfg.powerMode, v => { cfg.powerMode = v; renderPowers(); saveCfg(); });
  const sizeNote = () => { const z = SIZES[cfg.size]; $('#snote').textContent = `${z.cols * z.rows} cartas · ${z.pairs} parejas`; };
  seg($('#segSize'), Object.entries(SIZES).map(([k, z]) => [k, z.label]), () => cfg.size, v => { cfg.size = v; sizeNote(); saveCfg(); });
  sizeNote();
  paintMode();
  $('#tiles').innerHTML = THEMES.map(t => `<button class="tile" data-t="${t.id}" style="${themeVars(t)}" aria-pressed="false">${svgOf(t.icons[0])}<span>${t.name}</span></button>`).join('');
  $('#tiles').onclick = ev => { const x = ev.target.closest('.tile'); if (!x) return; cfg.theme = x.dataset.t; saveCfg(); applyTheme(); Sfx.play('tap'); };
  $('#plist').onclick = ev => {
    const row = ev.target.closest('button.prow'); if (!row) return; const id = row.dataset.p, i = cfg.picked.indexOf(id);
    if (i >= 0) cfg.picked.splice(i, 1); else if (cfg.picked.length < 3) cfg.picked.push(id); else { toast('Máximo 3 poderes por partida'); return; }
    Sfx.play('tap');
    saveCfg(); renderPowers();
  };
  $('#play').onclick = () => cfg.mode === 'online' ? Online.create() : startGame();
  $('#join').onclick = () => Online.openJoin();
  applyTheme(); renderPowers();
}

/* ====================== Estado del juego ====================== */
let S = null; // partida actual
const isAI = (G, t) => !!G.players[t].ai;
const board = $('#board');

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}
function showView(id) {
  ['home', 'game', 'lobby'].forEach(v => { const el = $('#' + v); el.hidden = v !== id; el.classList.remove('in'); });
  const el = $('#' + id); void el.offsetWidth; el.classList.add('in');
}

function startGame(rematch) {
  const th = theme(), ai = cfg.mode === 'ai';
  const pool = cfg.powerMode === 'random' ? shuf(PIDS).slice(0, 3) : PIDS.filter(p => cfg.picked.includes(p));
  const size = SIZES[cfg.size];
  const syms = shuf([...Array(th.icons.length).keys()]).slice(0, size.pairs);
  const deck = shuf([...syms, ...syms]);
  const G = {
    ai, diff: cfg.diff, ...(cfg.diff === 'hard' ? AI_LEVELS.hard : AI_LEVELS.easy), pool, th, size,
    players: [
      { name: 'Jugador 1', score: 0, used: {}, shield: false, frozen: false },
      { name: ai ? 'Máquina' : 'Jugador 2', score: 0, used: {}, shield: false, frozen: false, ai }
    ],
    rematch: !!rematch, turn: 0, first: null, busy: false, magnet: false, hint: null, over: false, aiRun: false, mem: new Map(),
    cards: deck.map((sym, i) => ({ id: i, sym, up: false, matched: false, owner: -1, el: null }))
  };
  mountGame(G);
  maybeAI(G);
}

/* Estadísticas de la partida y marcador de la serie de revanchas */
let SER = { w: [0, 0], t: 0, n: 0 };
const newStats = () => ({ t0: Date.now(), p: [0, 1].map(() => ({ tries: 0, hits: 0, streak: 0, best: 0 })) });
function statHit(G, i) { const s = G.st.p[i]; s.tries++; s.hits++; s.streak++; s.best = Math.max(s.best, s.streak); }
function statMiss(G, i) { const s = G.st.p[i]; s.tries++; s.streak = 0; }

/* Monta la partida en pantalla (lo usa también el modo en línea) */
function mountGame(G) {
  const th = G.th, pool = G.pool;
  S = G; G.st = newStats();
  if (!G.rematch) SER = { w: [0, 0], t: 0, n: 0 };
  closeSheet(true);
  $('#status').classList.remove('low');
  Sfx.play('start');
  document.documentElement.style.setProperty('--ui', th.ui);
  // tablero
  board.innerHTML = '';
  board.className = 'board s' + (G.sizeKey || cfg.size);
  G.cards.forEach(c => {
    const el = document.createElement('button');
    el.className = 'card'; el.type = 'button';
    el.innerHTML = `<span class="inner"><span class="face back"></span><span class="face front">${svgOf(th.icons[c.sym])}</span></span>`;
    el.onclick = () => onCard(c);
    c.el = el; board.appendChild(el);
  });
  // marcadores
  $('#scores').innerHTML = [0, 1].map(i => `<div class="pill p${i}" id="pl${i}"><div class="nm"><i></i><span></span></div><div class="sc">0</div><div class="pm"><div class="pw"></div><div class="bd"></div></div><i class="tbar" aria-hidden="true"></i></div>`).join('');
  // poderes
  $('#dr').innerHTML = pool.map(p => `<button class="pbtn" data-p="${p}" aria-label="${POWERS[p].name}: ${pdesc(p, G)}">${pIcon(POWERS[p].icon)}<span class="pn">${POWERS[p].name}</span><small class="pd" aria-hidden="true">${pdesc(p, G)}</small></button>`).join('');
  $('#dr').onclick = ev => {
    const b = ev.target.closest('.pbtn'); if (!b || !S || !can(S, b.dataset.p)) return;
    if (S.online) Online.power(b.dataset.p); else usePower(S, b.dataset.p);
  };
  showView('game');
  sync();
  const names = pool.map(p => POWERS[p].name).join(', ');
  setTimeout(() => S === G && toast(`Poderes de la partida: ${names}`), 500);
}

const myTurn = G => G.online ? G.turn === G.me && G.status === 'playing' : !isAI(G, G.turn);
function can(G, pid) {
  if (G.over || G.busy || G.first !== null || G.magnet) return false;
  if (G.online) {                                    // en línea: Barajar también vale en el turno del rival
    if (G.status !== 'playing' || G.players[G.me].used[pid]) return false;
    return G.turn === G.me || pid === 'shuffle';
  }
  return myTurn(G) && !G.players[G.turn].used[pid];
}

function sync() {
  const G = S; if (!G) return;
  G.cards.forEach((c, i) => {
    const el = c.el;
    el.classList.toggle('up', c.up); el.classList.toggle('done', c.matched);
    el.classList.toggle('o0', c.owner === 0); el.classList.toggle('o1', c.owner === 1);
    el.setAttribute('aria-label', c.up || c.matched ? `Carta ${i + 1}: ${G.th.names[c.sym]}` : `Carta ${i + 1}, boca abajo`);
  });
  [0, 1].forEach(i => {
    const p = G.players[i], el = $('#pl' + i); if (!el) return;
    el.classList.toggle('on', G.turn === i && !G.over);
    el.querySelector('.nm span').textContent = p.name;
    const sc = el.querySelector('.sc'); sc.textContent = p.score;
    if (el._s !== undefined && el._s !== p.score) { sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump'); }
    el._s = p.score;
    el.querySelector('.pw').innerHTML = G.pool.map(id => `<span class="${p.used[id] ? 'used' : ''}" title="${POWERS[id].name}${p.used[id] ? ' (usado)' : ''}">${pIcon(POWERS[id].icon)}</span>`).join('');
    el.querySelector('.bd').innerHTML = (p.frozen ? '<span class="badge fz">Congelado</span>' : '') + (p.shield ? '<span class="badge sh">Escudo</span>' : '') + (p.offline ? '<span class="badge off">Desconectado</span>' : '');
  });
  if (G.online) {
    const cur = G.players[G.me], mine = G.turn === G.me;
    const secs = G.left != null && !G.over ? ` · ${G.left} s` : '';
    $('#status').textContent = G.over ? 'Fin de la partida' : G.status === 'waiting' ? 'Esperando rival…' : (mine ? 'Tu turno' : 'Turno de tu rival') + secs;
    $('#status').classList.toggle('low', G.left != null && G.left <= 5 && !G.over);
    $('#dl').textContent = G.over ? '' : !mine ? (can(G, 'shuffle') ? 'Puedes barajar antes de que tu rival voltee' : 'Tus poderes · espera tu turno') : G.magnet ? 'Imán activo: voltea una carta' : G.first ? 'Voltea la segunda carta' : 'Tus poderes';
    $('#dr').querySelectorAll('.pbtn').forEach(b => {
      const id = b.dataset.p, used = cur.used[id];
      b.disabled = !can(G, id);
      b.classList.toggle('armed', id === 'magnet' && G.magnet);
      b.setAttribute('aria-label', `${POWERS[id].name}: ${pdesc(id, G)}${used ? ' (ya usado)' : ''}`);
    });
    return;
  }
  const cur = G.players[G.turn];
  $('#status').textContent = G.over ? 'Fin de la partida' : isAI(G, G.turn) ? `${cur.name} está jugando…` : `Turno de ${cur.name}`;
  $('#dl').textContent = G.over ? '' : isAI(G, G.turn) ? `Poderes de ${cur.name}` : G.magnet ? 'Imán activo: voltea una carta' : G.first ? 'Voltea la segunda carta' : `Poderes de ${cur.name}`;
  $('#dr').querySelectorAll('.pbtn').forEach(b => {
    const id = b.dataset.p, used = cur.used[id];
    b.disabled = !can(G, id);
    b.classList.toggle('armed', id === 'magnet' && G.magnet);
    b.setAttribute('aria-label', `${POWERS[id].name}: ${pdesc(id, G)}${used ? ' (ya usado)' : ''}`);
  });
}

function onCard(c) {
  const G = S; if (!G || G.over || G.busy || !myTurn(G) || c.up || c.matched) return;
  if (G.online) Online.flip(c); else pick(G, c);
}

function see(G, c) {
  if (!G.ai || Math.random() >= G.pRem) return;
  G.mem.delete(c); G.mem.set(c, c.sym);                    // lo más reciente queda al final
  while (G.mem.size > G.cap) G.mem.delete(G.mem.keys().next().value); // olvida lo más viejo
}

async function peek(G, cards, ms) {
  cards.forEach(c => c.el.classList.add('peek'));
  await sleep(ms);
  cards.forEach(c => c.el.classList.remove('peek'));
  await sleep(450);
}

async function pick(G, c) {
  if (c.up || c.matched || G.over) return;
  c.up = true; see(G, c); hap(8); Sfx.play('flip');
  if (!G.first) {
    G.first = c;
    if (G.magnet) {
      G.busy = true; G.magnet = false; sync();
      const p = G.cards.find(x => x !== c && x.sym === c.sym && !x.matched);
      G.hint = p; toast('Esa es su pareja');
      await sleep(250); if (G !== S) return;
      await peek(G, [p], 1300); if (G !== S) return;
      see(G, p); G.busy = false;
    }
    sync(); return;
  }
  const a = G.first; G.busy = true; sync();
  await sleep(750); if (G !== S) return;
  if (a.sym === c.sym) {
    a.matched = c.matched = true; a.owner = c.owner = G.turn;
    G.players[G.turn].score++; statHit(G, G.turn); G.mem.delete(a); G.mem.delete(c); G.first = null; G.hint = null;
    hap([12, 30, 12]); Sfx.play('match'); sync();
    await sleep(600); if (G !== S) return;
    G.busy = false;
    if (G.cards.every(x => x.matched)) { finish(G); return; }
    sync(); maybeAI(G);
  } else {
    await sleep(350); if (G !== S) return;
    statMiss(G, G.turn); a.up = c.up = false; G.first = null; G.hint = null; Sfx.play('miss'); sync();
    await sleep(500); if (G !== S) return;
    G.busy = false; endTurn(G);
  }
}

function endTurn(G) {
  const next = 1 - G.turn, nx = G.players[next];
  if (nx.frozen) { nx.frozen = false; toast(`${nx.name} pierde su turno`); }
  else G.turn = next;
  G.magnet = false; sync(); maybeAI(G);
}

async function usePower(G, pid) {
  const me = G.players[G.turn], op = G.players[1 - G.turn], P = POWERS[pid];
  me.used[pid] = true; hap(15); sync();
  if (pid !== 'shield' && op.shield) {
    op.shield = false; Sfx.play('block'); toast(`El escudo de ${op.name} bloqueó ${P.name}`); sync(); await sleep(900); return;
  }
  Sfx.play(pid);
  if (pid === 'vision') {
    G.busy = true; sync(); toast(`${me.name} usó Visión`);
    const pk = shuf(G.cards.filter(c => !c.matched && !c.up)).slice(0, G.size.vision);
    await peek(G, pk, 1600); if (G !== S) return;
    pk.forEach(c => see(G, c)); G.busy = false;
  } else if (pid === 'freeze') {
    op.frozen = true; toast(`${op.name} perderá su próximo turno`);
  } else if (pid === 'shuffle') {
    G.busy = true; sync(); toast(`${me.name} barajó las cartas`);
    await shuffleCards(G); if (G !== S) return;
    G.mem.clear(); G.busy = false;
  } else if (pid === 'magnet') {
    G.magnet = true; toast(isAI(G, G.turn) ? `${me.name} usó Imán` : 'Voltea una carta: verás su pareja');
  } else if (pid === 'shield') {
    me.shield = true; toast(`${me.name} activó su Escudo`);
  }
  sync();
}

async function shuffleCards(G) {
  const slots = G.cards.map((c, i) => i).filter(i => !G.cards[i].matched);
  const sh = shuf(slots.map(i => G.cards[i]));
  const before = new Map(G.cards.map(c => [c, c.el.getBoundingClientRect()]));
  slots.forEach((slot, k) => { G.cards[slot] = sh[k]; });
  G.cards.forEach(c => board.appendChild(c.el));
  const anims = [];
  G.cards.forEach(c => {
    if (c.matched) return;
    const a = before.get(c), b = c.el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (dx || dy) anims.push(c.el.animate([
      { transform: `translate(${dx}px,${dy}px) scale(.92)` },
      { transform: `translate(${dx * .5}px,${dy * .5}px) scale(1.05)`, offset: .5 },
      { transform: 'none' }
    ], { duration: 750, easing: 'cubic-bezier(.3,.9,.3,1)' }).finished);
  });
  await Promise.all(anims); sync();
}

/* ====================== IA ====================== */
function knownPair(G) {
  const seen = new Map();
  for (const [c, s] of G.mem) { if (c.matched || c.up) continue; if (seen.has(s)) return [seen.get(s), c]; seen.set(s, c); }
  return null;
}
function aiPower(G) {
  const me = G.players[G.turn], op = G.players[1 - G.turn];
  const av = G.pool.filter(p => !me.used[p]); if (!av.length) return null;
  if (G.diff === 'easy') return Math.random() < .2 ? rnd(av) : null;
  const left = G.cards.filter(c => !c.matched).length / 2, kp = !!knownPair(G), opLeft = G.pool.some(p => !op.used[p]);
  if (av.includes('magnet') && !kp && Math.random() < .7) return 'magnet';
  if (av.includes('vision') && G.mem.size < 4 && left >= 4 && Math.random() < .6) return 'vision';
  if (av.includes('shuffle') && op.score - me.score >= 2 && Math.random() < .6) return 'shuffle';
  if (av.includes('freeze') && (kp || op.score >= me.score) && left <= 5 && Math.random() < .6) return 'freeze';
  if (av.includes('shield') && opLeft && Math.random() < .3) return 'shield';
  return null;
}
function aiFirst(G) {
  const avail = G.cards.filter(c => !c.matched && !c.up), kp = knownPair(G);
  if (kp && Math.random() < G.use) return kp[0];
  const unk = avail.filter(c => !G.mem.has(c));
  return rnd(unk.length ? unk : avail);
}
function aiSecond(G, a) {
  let m = null;
  for (const [c, s] of G.mem) if (c !== a && !c.matched && !c.up && s === a.sym) m = c;
  if (G.hint && G.hint !== a && !G.hint.matched && G.hint.sym === a.sym) m = G.hint;
  if (m && Math.random() < G.use) return m;
  const avail = G.cards.filter(c => !c.matched && !c.up && c !== a);
  const unk = avail.filter(c => !G.mem.has(c) && c !== m);
  const pool = unk.length ? unk : avail.filter(c => c !== m);
  return rnd(pool.length ? pool : avail);
}
const tutWait = () => new Promise(r => { const t = () => (typeof Tutorial !== 'undefined' && Tutorial.open) ? setTimeout(t, 200) : r(); t(); });
async function aiStep(G) {
  await sleep(800); await tutWait(); if (G !== S || G.over) return;
  const pw = aiPower(G);
  if (pw) { await usePower(G, pw); if (G !== S || G.over) return; await sleep(650); if (G !== S) return; }
  await tutWait(); if (G !== S || G.over) return;
  const a = aiFirst(G); await pick(G, a); if (G !== S || G.over) return;
  await sleep(750); await tutWait(); if (G !== S) return;
  await pick(G, aiSecond(G, a));
}
async function maybeAI(G) {
  if (G.aiRun || G.over || !isAI(G, G.turn)) return;
  G.aiRun = true;
  try { while (G === S && !G.over && isAI(G, G.turn)) await aiStep(G); }
  finally { G.aiRun = false; }
}

/* ====================== Fin, hojas y navegación ====================== */
const scrim = $('#scrim'), sheet = $('#sheet');
let sheetLock = false;
function openSheet(html, lock) {
  sheet.innerHTML = html; sheetLock = !!lock; scrim.classList.add('show');
  setTimeout(() => { const b = sheet.querySelector('button'); b && b.focus({ preventScroll: true }); }, 60);
}
function closeSheet(now) { scrim.classList.remove('show'); sheetLock = false; if (now) sheet.innerHTML = ''; }
scrim.addEventListener('click', ev => {
  const act = ev.target.closest('[data-act]');
  if (act) {
    const k = act.dataset.act;
    if (k === 'tutorial') { closeSheet(); Sfx.play('tap'); setTimeout(() => Tutorial.start(S), 200); return; }
    if (k === 'rematch') { if (S && S.online) { closeSheet(); Online.rematch(); } else startGame(true); }
    else if (k === 'menu' || k === 'leave') { if (S && S.online) Online.leave(); S = null; closeSheet(); showView('home'); }
    else closeSheet();
    return;
  }
  if (ev.target === scrim && !sheetLock) closeSheet();
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && scrim.classList.contains('show') && !sheetLock) closeSheet(); });

async function finish(G) {
  G.over = true; sync(); hap([20, 40, 20]);
  await sleep(700); if (G !== S) return;
  const [p0, p1] = G.players, tie = p0.score === p1.score, w = p0.score > p1.score ? 0 : 1;
  Sfx.play(tie ? 'tie' : (G.online ? w === G.me : !G.ai || w === 0) ? 'win' : 'lose');
  const title = tie ? 'Empate' : G.online ? (w === G.me ? '¡Ganaste!' : 'Ganó tu rival') : (G.ai ? (w === 0 ? '¡Ganaste!' : 'Ganó la máquina') : `Ganó ${G.players[w].name}`);
  const sub = tie ? 'Misma cantidad de parejas.' : `${G.players[w].score} parejas contra ${G.players[1 - w].score}.`;
  if (!G.counted) { G.counted = true; SER.n++; if (tie) SER.t++; else SER.w[w]++; }
  const dur = Math.max(1, Math.round((Date.now() - G.st.t0) / 1000)), mm = Math.floor(dur / 60), ss = String(dur % 60).padStart(2, '0');
  const st = [0, 1].map(i => { const s = G.st.p[i], u = Object.values(G.players[i].used || {}).filter(Boolean).length;
    return { hits: G.players[i].score, acc: s.tries ? Math.round(100 * s.hits / s.tries) : 0, best: s.best, pw: u }; });
  const cell = (k, i, suf = '') => { const v = st[i][k], o = st[1 - i][k]; return `<b${v > o ? ' class="top"' : ''}>${v}${suf}</b>`; };
  const rows = [['Parejas', 'hits', ''], ['Precisión', 'acc', '%'], ['Mejor racha', 'best', ''], ['Poderes usados', 'pw', '']]
    .map(([l, k, s]) => `<div class="strow">${cell(k, 0, s)}<span>${l}</span>${cell(k, 1, s)}</div>`).join('');
  const series = SER.n > 1 ? `<p class="series">Serie · ${G.players[0].name} ${SER.w[0]} – ${SER.w[1]} ${G.players[1].name}${SER.t ? ` · ${SER.t} empate${SER.t > 1 ? 's' : ''}` : ''}</p>` : '';
  openSheet(`<h2>${title}</h2><p class="sub2">${sub}</p>
    <div class="res">${[0, 1].map(i => `<div class="o${i}${!tie && w === i ? ' w' : ''}"><small>${G.players[i].name}</small><b>${G.players[i].score}</b></div>`).join('')}</div>
    <div class="stats">${rows}</div>
    <p class="series dur">Duración ${mm}:${ss}</p>${series}
    <div class="acts"><button class="btn" data-act="rematch">Revancha</button><button class="btn sec" data-act="menu">Menú</button></div>`, true);
}

$('#back').onclick = () => {
  if (!S) return;
  if (S.over) { if (S.online) Online.leave(); S = null; showView('home'); return; }
  openSheet(`<h2>¿Salir?</h2><p class="sub2">Se perderá el progreso de esta partida.</p><div class="acts" style="margin-top:22px"><button class="btn" data-act="close">Seguir jugando</button><button class="btn sec" data-act="leave">Salir al menú</button></div>`);
};
$('#help').onclick = () => {
  if (!S) return;
  openSheet(`<h2>Poderes</h2><p class="rules">Úsalos al inicio de tu turno, antes de voltear. Cada jugador los usa una sola vez.</p>
    <div class="plist">${S.pool.map(id => `<div class="prow"><span class="pi">${pIcon(POWERS[id].icon)}</span><span class="pt"><b>${POWERS[id].name}</b><small>${pdesc(id, S)}</small></span></div>`).join('')}</div>
    <div class="acts" style="margin-top:18px"><button class="btn" data-act="close">Entendido</button><button class="btn sec" data-act="tutorial">¿Cómo se juega? Ver tutorial</button></div>`);
};

initHome();
if (location.hash === '#debug') Object.defineProperty(window, '__dbg', { get: () => ({ S, pick, usePower, can, sync, startGame }) });