'use strict';
/* ====================== Idiomas ======================
   El código fuente está en español. Este módulo traduce el texto que aparece en pantalla (nodos de texto y
   atributos aria-label/title/placeholder) con un diccionario, y vuelve al original al cambiar de idioma.
   Para añadir un idioma: agrega su nombre en NAMES y su diccionario en DICT (copia EN y traduce).
   Frases con datos usan {0}, {1}… ("Turno de {0}"); los datos que sean palabras conocidas también se traducen. */
const I18N = (() => {
  const NAMES = { es: 'Español', en: 'English' };
  const KEY = 'pcp-lang';

  const EN = {
    // ---- Menú
    'Encuentra las parejas y usa tus poderes en el momento justo.': 'Find the pairs and use your powers at just the right moment.',
    '¿Cómo se juega?': 'How to play',
    'Mis récords': 'My records',
    'Jugadores': 'Players', 'Dificultad de la máquina': 'Machine difficulty', 'Tablero': 'Board', 'Tema': 'Theme', 'Poderes': 'Powers',
    '2 jugadores': '2 players', 'Máquina': 'Machine', 'En línea': 'Online', 'Fácil': 'Easy', 'Difícil': 'Hard',
    'Aleatorios': 'Random', 'Elegir': 'Pick',
    'Jugar': 'Play', 'Crear sala': 'Create room', 'Unirme con código': 'Join with code',
    'Tú eliges tablero, tema y poderes; los demás se unen con el código o el QR (hasta 4 jugadores). Tú decides cuándo empezar.':
      'You choose the board, theme and powers; the others join with the code or QR (up to 4 players). You decide when to start.',
    'Instalar app': 'Install app', 'Corona de racha perfecta': 'Perfect streak crown', 'Configuración de la partida': 'Game setup',
    'Ajustes': 'Settings', 'Información': 'Information', 'Idioma': 'Language', 'Música': 'Music', 'Efectos': 'Effects', 'Listo': 'Done',
    'Apagar música': 'Turn music off', 'Encender música': 'Turn music on', 'Apagar efectos': 'Turn effects off', 'Encender efectos': 'Turn effects on',
    'Máximo 3 poderes por partida': 'Max 3 powers per game',
    'Máximo 3 por partida. Cada jugador usa cada poder una sola vez.': 'Max 3 per game. Each player uses each power only once.',
    'Elige de 1 a 3 poderes para esta partida.': 'Pick 1 to 3 powers for this game.',
    'Tema secreto desbloqueado: Medianoche': 'Secret theme unlocked: Midnight', 'Medianoche activado': 'Midnight activated',
    'Corona desbloqueada: la verás en el menú': 'Crown unlocked: you\'ll see it on the menu',

    // ---- Temas y cartas
    'Océano': 'Ocean', 'Bosque': 'Forest', 'Dulce': 'Sweet', 'Medianoche': 'Midnight',
    'pez': 'fish', 'medusa': 'jellyfish', 'estrella de mar': 'starfish', 'concha': 'shell', 'ola': 'wave', 'burbujas': 'bubbles', 'velero': 'sailboat',
    'coral': 'coral', 'tortuga': 'turtle', 'pulpo': 'octopus', 'ballena': 'whale', 'cangrejo': 'crab', 'ancla': 'anchor', 'faro': 'lighthouse',
    'delfín': 'dolphin', 'ostra': 'oyster', 'alga': 'seaweed', 'pez globo': 'pufferfish',
    'hoja': 'leaf', 'pino': 'pine', 'hongo': 'mushroom', 'bellota': 'acorn', 'mariposa': 'butterfly', 'sol': 'sun', 'flor': 'flower', 'lluvia': 'rain',
    'búho': 'owl', 'caracol': 'snail', 'montaña': 'mountain', 'tulipán': 'tulip', 'trébol': 'clover', 'arcoíris': 'rainbow', 'manzana': 'apple',
    'abeja': 'bee', 'fogata': 'campfire', 'cabaña': 'cabin',
    'helado': 'ice cream', 'cupcake': 'cupcake', 'piruleta': 'lollipop', 'dona': 'donut', 'corazón': 'heart', 'macaron': 'macaron', 'caramelo': 'candy',
    'fresa': 'strawberry', 'galleta': 'cookie', 'pastel': 'cake', 'chocolate': 'chocolate', 'paleta': 'popsicle', 'cerezas': 'cherries',
    'osito de goma': 'gummy bear', 'flan': 'flan', 'bastón de caramelo': 'candy cane', 'malteada': 'milkshake', 'chocolate caliente': 'hot chocolate',
    'planeta': 'planet', 'luna': 'moon', 'estrella': 'star', 'cohete': 'rocket', 'cometa': 'comet', 'galaxia': 'galaxy', 'ovni': 'UFO', 'casco': 'helmet',
    'satélite': 'satellite', 'telescopio': 'telescope', 'Tierra': 'Earth', 'alien': 'alien', 'asteroide': 'asteroid', 'constelación': 'constellation',
    'agujero negro': 'black hole', 'Marte': 'Mars', 'bandera': 'flag', 'eclipse': 'eclipse',

    // ---- Poderes
    'Visión': 'Vision', 'Congelar': 'Freeze', 'Barajar': 'Shuffle', 'Imán': 'Magnet', 'Intercambio': 'Swap', 'Brújula': 'Compass', 'Espejo': 'Mirror',
    'Cegera': 'Blindness', 'Cuarentena': 'Quarantine', 'Escudo': 'Shield',
    'Ves cartas al azar por un instante': 'You see random cards for a moment',
    'Tu rival pierde su turno si aún no voltea': 'Your rival loses their turn if they haven\'t flipped yet',
    'Mezcla las cartas sin pareja': 'Mixes the unmatched cards',
    'Ves la pareja de tu carta por un momento': 'You see your card\'s match for a moment',
    'Una carta se cambia por otra al azar': 'A card is swapped with a random one',
    'Te señala 2 cartas, 1 es la pareja': 'Points to 2 cards, 1 is the match',
    'Copias el último poder de tu rival': 'You copy your rival\'s last power',
    'Los demás no ven las que volteas en tu turno': 'The others can\'t see the cards you flip on your turn',
    'Aíslas una carta hasta tu siguiente turno': 'You isolate a card until your next turn',
    'Bloquea el próximo poder de tu rival': 'Blocks your rival\'s next power',
    'Mezcla las cartas sin pareja. También en turno ajeno.': 'Mixes the unmatched cards. Also works on another player\'s turn.',
    'Eliges a un jugador: pierde su turno.': 'You pick a player: they lose their turn.',
    'Copias el último poder de otro jugador.': 'You copy another player\'s last power.',

    // ---- Partida
    'Jugador 1': 'Player 1', 'Jugador 2': 'Player 2', 'Jugador 3': 'Player 3', 'Jugador 4': 'Player 4',
    'Tu turno': 'Your turn', 'Fin de la partida': 'Game over', 'Esperando rival…': 'Waiting for rival…', 'Sin conexión… reconectando': 'Offline… reconnecting',
    'Tus poderes · espera tu turno': 'Your powers · wait for your turn', 'Tus poderes': 'Your powers',
    'Imán activo: voltea una carta': 'Magnet active: flip a card', 'Voltea la segunda carta': 'Flip the second card',
    'Salir de la partida': 'Leave the game', 'Ver poderes y reglas': 'See powers and rules', 'Enviar reacción': 'Send reaction', 'Reacciones': 'Reactions',
    'Carta aislada: se libera en el siguiente turno de quien la aisló': 'Isolated card: it is released on the next turn of whoever isolated it',
    'Esa es su pareja': 'That\'s its match',
    'Voltea una carta: verás su pareja': 'Flip a card: you\'ll see its match',
    'Intercambio: tu carta se cambió por otra al azar': 'Swap: your card was swapped with a random one',
    'Brújula: una de las 2 cartas marcadas es su pareja': 'Compass: one of the 2 marked cards is its match',
    'Cegera: la máquina no verá tus cartas este turno': 'Blindness: the machine won\'t see your cards this turn',
    'Elige a un jugador': 'Pick a player', 'Elige 2 cartas': 'Pick 2 cards', 'Elige una carta': 'Pick a card',
    'Ahora elige 2 cartas': 'Now pick 2 cards', 'Ahora elige una carta': 'Now pick a card',
    'Ya eligió una carta: espera a que termine': 'They already picked a card: wait until they finish',
    'Congelado': 'Frozen', 'Desconectado': 'Disconnected',
    '¡Racha perfecta!': 'Perfect streak!',
    'tú': 'you',
    'Pásale el celular.': 'Pass the phone.', 'No volver a mostrar este aviso': 'Don\'t show this again',

    // ---- Hojas
    'Cerrar': 'Close', 'Entendido': 'Got it', 'Atrás': 'Back', 'Siguiente': 'Next', 'Cancelar': 'Cancel',
    'Solo se guardan en este dispositivo.': 'They\'re only saved on this device.',
    'Ganadas': 'Won', 'Empates': 'Ties', 'Perdidas': 'Lost',
    'Máquina fácil': 'Easy machine', 'Máquina difícil': 'Hard machine',
    'Racha de victorias vs máquina': 'Win streak vs machine', 'Mejor racha de parejas': 'Best pair streak',
    'Parejas encontradas': 'Pairs found', 'Partidas de 2 en un celular': '2-player games on one phone',
    'Aún no hay partidas. ¡A jugar!': 'No games yet. Let\'s play!', 'Borrar récords': 'Delete records', '¿Seguro? Toca otra vez': 'Sure? Tap again',
    '¡Ganaste!': 'You won!', 'Ganó la máquina': 'The machine won', 'Ganó tu rival': 'Your rival won', 'Empate': 'Tie',
    'Misma cantidad de parejas.': 'Same number of pairs.',
    'Parejas': 'Pairs', 'Precisión': 'Accuracy', 'Mejor racha': 'Best streak', 'Poderes usados': 'Powers used',
    'Sortear poderes de nuevo': 'Draw powers again', 'Revancha': 'Rematch', 'Menú': 'Menu',
    '¿Salir?': 'Leave?', 'Se perderá el progreso de esta partida.': 'This game\'s progress will be lost.', 'Seguir jugando': 'Keep playing', 'Salir al menú': 'Back to menu',
    'Úsalos al inicio de tu turno, antes de voltear. Cada jugador los usa una sola vez.': 'Use them at the start of your turn, before flipping. Each player uses them only once.',

    // ---- Tutorial
    'Encuentra las parejas': 'Find the pairs',
    'Gana quien consiga más parejas al final. Cada pareja es de quien la encuentra.': 'Whoever gets the most pairs at the end wins. Each pair belongs to whoever finds it.',
    'Voltea 2 cartas. Si son iguales, la pareja es tuya y vuelves a jugar. Si no, se cierran y le toca al siguiente.': 'Flip 2 cards. If they match, the pair is yours and you play again. If not, they close and it\'s the next player\'s turn.',
    'Cada partida trae 3 poderes, sorteados o elegidos. Cada jugador usa cada uno una sola vez, al inicio de su turno.': 'Each game has 3 powers, drawn or chosen. Each player uses each one only once, at the start of their turn.',
    'Los 10 poderes': 'The 10 powers',
    'Crea una sala y comparte el código o el QR: juegan hasta 4. Tienes 15 segundos por jugada; si se acaban, pierdes el turno. Algunos poderes (Escudo, Barajar, Intercambio, Congelar, Cuarentena) también valen en el turno de otro.':
      'Create a room and share the code or QR: up to 4 can play. You get 15 seconds per move; if time runs out, you lose your turn. Some powers (Shield, Shuffle, Swap, Freeze, Quarantine) also work on someone else\'s turn.',

    // ---- En línea
    'Comparte el código · hasta 4 jugadores': 'Share the code · up to 4 players', 'Código QR para unirse a la sala': 'QR code to join the room',
    'Jugadores en la sala': 'Players in the room', 'Copiar enlace': 'Copy link', 'Empezar partida': 'Start game', 'Esperando jugadores…': 'Waiting for players…',
    'Escribe el código de la sala': 'Enter the room code', 'Código de la sala': 'Room code', 'Unirme': 'Join',
    '¿Tienes el QR? Escanéalo con la cámara de tu celular y entrarás directo.': 'Got the QR? Scan it with your phone camera and you\'ll jump right in.',
    'Conectando…': 'Connecting…', 'Volver al menú': 'Back to menu', 'Creando sala…': 'Creating room…', 'Uniéndote a la sala…': 'Joining the room…',
    'Esperando jugador…': 'Waiting for player…', 'Con 3 o 4 jugadores se recomienda 6 × 6. Toca para cambiarlo.': 'With 3 or 4 players, 6 × 6 is recommended. Tap to change it.',
    'Toca para cambiar el tablero.': 'Tap to change the board.',
    'Puedes empezar ya o esperar a más jugadores': 'You can start now or wait for more players', 'Sala llena: ¡a jugar!': 'Room full: let\'s play!',
    'Esperando jugadores… (hasta 4)': 'Waiting for players… (up to 4)',
    'No se pudo cargar Firebase. Revisa tu conexión.': 'Couldn\'t load Firebase. Check your connection.', 'No se pudo conectar con Firebase.': 'Couldn\'t connect to Firebase.',
    'No se pudo crear la sala. Intenta de nuevo.': 'Couldn\'t create the room. Try again.', 'El código tiene 6 caracteres (sin 0, O, 1 ni I).': 'The code has 6 characters (no 0, O, 1 or I).',
    'No existe una sala con ese código.': 'There\'s no room with that code.', 'La partida ya empezó.': 'The game has already started.', 'Esa sala ya está llena.': 'That room is full.',
    'No se pudo unir a la sala.': 'Couldn\'t join the room.', 'Conexión recuperada': 'Connection restored', 'La sala se cerró': 'The room was closed',
    'El creador empezó la partida sin ti': 'The host started the game without you', 'Nueva partida: empiezas tú': 'New game: you start',
    'Sin conexión: intenta de nuevo': 'Offline: try again', 'Algo salió mal con la conexión': 'Something went wrong with the connection',
    'Tarde: ya voltearon una carta. No gastaste el poder': 'Too late: a card was already flipped. You didn\'t spend the power',
    'Usaste Visión': 'You used Vision',
    'Te congelaron: pierdes este turno': 'You were frozen: you lose this turn', 'Te congelaron: pierdes tu próximo turno': 'You were frozen: you lose your next turn',
    'Activaste tu Escudo (dura 1 ronda)': 'You activated your Shield (lasts 1 round)', 'Aislaste una carta hasta tu próximo turno': 'You isolated a card until your next turn',
    'Cegera: los demás no verán tus cartas este turno': 'Blindness: the others won\'t see your cards this turn',
    'Se acabó tu tiempo': 'Your time ran out', 'Estás congelado: pierdes este turno': 'You\'re frozen: you lose this turn',
    'Estás abriendo el juego desde tu computador: el QR solo funcionará en otro celular cuando el juego esté publicado. Mientras tanto, usen el código.':
      'You\'re opening the game from your computer: the QR will only work on another phone once the game is published. Meanwhile, use the code.',
    '¡Bien!': 'Nice!', '¡Uy!': 'Oops!', '¡Vamos!': 'Let\'s go!', 'Jaja': 'Haha',

    // ---- Instalar
    'Instalar en iPhone': 'Install on iPhone',
    'Toca': 'Tap', 'Compartir': 'Share', 'en Safari y elige': 'in Safari and choose', 'Agregar a inicio': 'Add to Home Screen',
    '. Se abrirá a pantalla completa, como una app.': '. It will open full screen, like an app.'
  };

  // Frases con datos. Los {n} se traducen también si son palabras conocidas (nombres de poderes, cartas…).
  const R = [
    ['Poderes de la partida: {0}', 'Powers this game: {0}'], ['Tu nombre (máx. {0} letras)', 'Your name (max. {0} letters)'],
    ['Se sortean 3 de los {#0} al empezar. Cada jugador usa cada poder una sola vez.', '3 of the {0} are drawn at the start. Each player uses each power only once.'],
    ['Turno de {0}', '{0}\'s turn'], ['Poderes de {0}', '{0}\'s powers'], ['{0} está jugando…', '{0} is playing…'],
    ['Puedes usar ahora: {0}', 'You can use now: {0}'],
    ['{0} (tú)', '{0} (you)'], ['{0} (usado)', '{0} (used)'], ['{0} (ya usado)', '{0} (already used)'],
    ['Carta {0}: {1}', 'Card {0}: {1}'], ['Carta {0}, boca abajo', 'Card {0}, face down'], ['{0} (aislada)', '{0} (isolated)'],
    ['{0}: {1}', '{0}: {1}', 6],
    ['{0} cartas · {1} parejas', '{0} cards · {1} pairs'],
    ['Ves {0} cartas al azar por un instante.', 'You see {0} random cards for a moment.'],
    ['¡Racha x{0}!', 'Streak x{0}!'],
    ['{0} pierde su turno', '{0} loses their turn'], ['{0} perderá su próximo turno', '{0} will lose their next turn'],
    ['{0} barajó las cartas', '{0} shuffled the cards'], ['{0} usó {1}: {2}', '{0} used {1}: {2}'],
    ['{0} usó Visión', '{0} used Vision'], ['{0} usó Imán', '{0} used Magnet'], ['{0} usó Intercambio', '{0} used Swap'],
    ['{0} usó Brújula', '{0} used Compass'], ['{0} usó Cegera: no verás sus cartas este turno', '{0} used Blindness: you won\'t see their cards this turn'],
    ['{0} usó Intercambio: una carta cambió de lugar', '{0} used Swap: a card changed places'],
    ['{0} activó su Escudo', '{0} activated their Shield'],
    ['{0} aisló una carta hasta su próximo turno', '{0} isolated a card until their next turn'],
    ['{0} copió {1}', '{0} copied {1}'], ['Copiaste {0}', 'You copied {0}'], ['{0} usó {1}', '{0} used {1}'],
    ['El escudo de {0} bloqueó {1}', '{0}\'s shield blocked {1}'], ['El escudo de {0} bloqueó a {1}', '{0}\'s shield blocked {1}'],
    ['Tu escudo bloqueó {0} de {1}', 'Your shield blocked {0} from {1}'],
    ['A {0} se le acabó el tiempo', '{0} ran out of time'],
    ['{0} se desconectó', '{0} disconnected'], ['{0} volvió', '{0} is back'],
    ['Nueva partida: empieza {0}', 'New game: {0} starts'],
    ['Empezar con {0} jugadores', 'Start with {0} players'], ['El creador juega en {0}.', 'The host plays on {0}.'],
    ['Esperando que {0} inicie la partida…', 'Waiting for {0} to start the game…'],
    ['Únete a mi sala: {0}', 'Join my room: {0}'],
    ['{0}: toca a un jugador', '{0}: tap a player'], ['{0}: elige 2 cartas ({1}/2)', '{0}: pick 2 cards ({1}/2)'], ['{0}: elige una carta', '{0}: pick a card'],
    ['{0}: elige 1 carta', '{0}: pick 1 card'],
    ['Empate: {0}', 'Tie: {0}'], ['Ganó {0}', '{0} won'],
    ['{0} parejas cada uno.', '{0} pairs each.'], ['{0} parejas, {1} más que el segundo.', '{0} pairs, {1} more than second place.'],
    ['{0} parejas contra {1}.', '{0} pairs to {1}.'], ['Duración {0}', 'Duration {0}'], ['Serie · {0}', 'Series · {0}'],
    ['{0} empate', '{0} tie'], ['{0} empates', '{0} ties'],
    ['Tu récord · {0}: {1} G · {2} E · {3} P', 'Your record · {0}: {1} W · {2} T · {3} L'],
    ['{0} partida jugada', '{0} game played'], ['{0} partidas jugadas', '{0} games played'],
    ['{0} (mejor {1})', '{0} (best {1})'], ['{#0} de {#1}', '{0} of {1}'], ['{0} y {1}', '{0} and {1}']
  ];

  const esc = s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const compile = rules => rules.map(([a, b, pri]) => ({ re: new RegExp('^' + esc(a).replace(/\{#(\d+)\}/g, '(\\d+)').replace(/\{(\d+)\}/g, '(.+?)') + '$', 's'), to: b, len: pri || a.replace(/\{#?\d+\}/g, '').length }))
    .sort((x, y) => y.len - x.len);
  const DICT = { en: { map: EN, rules: compile(R) } };

  let lang = 'es';
  try { const sv = localStorage.getItem(KEY); lang = sv && NAMES[sv] ? sv : (/^es/i.test(navigator.language || 'es') ? 'es' : 'en'); } catch (e) {}

  function tr(s, l) {
    const d = DICT[l || lang]; if (!d || !s) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2]; if (!core) return s;
    let out = d.map[core];
    if (out === undefined) {
      out = core;
      for (const r of d.rules) { const x = r.re.exec(core); if (x) { out = r.to.replace(/\{(\d+)\}/g, (_, i) => tr(x[+i + 1], l)); break; } }
      if (out === core && core.includes(', ')) out = core.split(', ').map(p => tr(p, l)).join(', ');   // listas: "Visión, Imán, Escudo"
      out = out.replace(/\bJugador (\d)\b/g, 'Player $1').replace(/\bMáquina\b/g, 'Machine');
    }
    return m[1] + out + m[3];
  }

  const ATTRS = ['aria-label', 'title', 'placeholder'];
  const tn = new WeakMap(), an = new WeakMap();
  const SKIP = { SCRIPT: 1, STYLE: 1, SVG: 1, svg: 1, SELECT: 1, OPTION: 1, TEXTAREA: 1 };

  function doText(n) {
    const v = n.nodeValue, r = tn.get(n);
    if (r && v === r.en) { const t = lang === 'es' ? r.es : r.en; if (v !== t) n.nodeValue = t; return; }
    if (lang === 'es') { if (r) tn.delete(n); return; }
    const en = tr(v, 'en'); if (en === v) { if (r) tn.delete(n); return; }
    tn.set(n, { es: v, en }); n.nodeValue = en;
  }
  function doAttr(el, a) {
    const v = el.getAttribute(a); if (v == null) return;
    let o = an.get(el); if (!o) an.set(el, o = {});
    const r = o[a];
    if (r && v === r.en) { const t = lang === 'es' ? r.es : r.en; if (v !== t) el.setAttribute(a, t); return; }
    if (lang === 'es') { delete o[a]; return; }
    const en = tr(v, 'en'); if (en === v) { delete o[a]; return; }
    o[a] = { es: v, en }; el.setAttribute(a, en);
  }
  function walk(root) {
    if (root.nodeType === 3) { if (!(root.parentNode && SKIP[root.parentNode.nodeName])) doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { ATTRS.forEach(a => root.hasAttribute(a) && doAttr(root, a)); if (SKIP[root.nodeName]) return; }
    for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
  }

  let mo = null;
  function start() {
    mo = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') { if (!(m.target.parentNode && SKIP[m.target.parentNode.nodeName])) doText(m.target); }
        else if (m.type === 'attributes') doAttr(m.target, m.attributeName);
        else m.addedNodes.forEach(walk);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    walk(document.documentElement);
  }

  function set(l) {
    if (!NAMES[l]) return;
    lang = l; try { localStorage.setItem(KEY, l); } catch (e) {}
    document.documentElement.lang = l;
    walk(document.documentElement);
    dispatchEvent(new Event('langchange'));
  }

  document.documentElement.lang = lang;
  start();
  return { get lang() { return lang; }, names: NAMES, set, t: s => tr(s), tr };
})();
