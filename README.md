# Boom Duo

Juego de memoria con poderes (antes "Parejas explosivas" y "Parejas con poderes"): 2 jugadores en el mismo dispositivo, contra la máquina o **en línea de 2 a 4 jugadores** (Firebase).

## Estructura

```
www/                  ← el juego web (esto se publica en Firebase y se empaqueta en las apps)
  index.html, styles.css, app.js, online.js, audio.js, tutorial.js, pwa.js, sw.js
  firebase-config.js, manifest.webmanifest, icons/, vendor/qrcode.js
assets/               ← icono y splash fuente (PNG) para generar los de iOS y Android
ios/  android/        ← proyectos nativos (los crea `npm run setup`)
capacitor.config.json ← id de la app, nombre y carpeta web
package.json          ← scripts y Capacitor
database.rules.json, firebase.json, .firebaserc ← Firebase
```

## Probar en tu computador

- Local y contra la máquina: abre `www/index.html` directamente.
- En línea: ábrelo con **Live Server** de VS Code (`http://127.0.0.1:5500`) y usa dos **pestañas**: cada pestaña es un jugador distinto. Crea la sala en una y únete con el código en la otra.
  (Abriendo el archivo directo, `file://`, Firebase puede rechazar el inicio de sesión.)

## Publicar (necesario para que el QR funcione en otro celular)

```bash
npm install -g firebase-tools   # una sola vez
firebase login                  # una sola vez, con la cuenta dueña del proyecto
firebase deploy                 # en esta carpeta: publica `www/` y las reglas
```

Queda en: https://parejas-explosivas.web.app

## Cómo funciona el modo en línea

- Cada jugador entra con **inicio de sesión anónimo** (sin registrarse).
- La sala vive en `rooms/CÓDIGO` de Realtime Database; ambos escuchan ese nodo.
- Cada jugada se escribe con una **transacción**, así dos toques al tiempo no rompen el estado.
- Visión, Imán y Brújula solo se muestran en la pantalla de quien los usa; Congelar, Escudo, Barajar, Intercambio, Cuarentena, Cegera y Espejo cambian el estado compartido (`quar`, `short`, `last` en `game`).
- Poderes (10, se juegan 3 por partida): Visión, Congelar (se usa en cualquier momento; si el rival aún no eligió carta en su turno, lo pierde de inmediato), Barajar, Imán (también con una carta ya volteada), Escudo (dura 1 ronda; se activa en cualquier momento, también en el turno del rival), Intercambio (se usa en cualquier momento: eliges una carta sin voltear y se cambia por otra al azar; nadie ve cuál), Brújula (voltea la carta elegida; también con una ya volteada), Espejo, Cegera (antes de elegir carta; en ese turno los demás no ven las cartas que volteas. No aparece en 2 jugadores con una sola pantalla) y Cuarentena (se usa en cualquier momento; hasta tu siguiente turno).
- **Tiempo por jugada: 15 s** (`TURN_MS` en `online.js`). Se mide con la hora del servidor de Firebase, así ambos ven el mismo reloj. Si se acaba, el turno pasa al siguiente jugador conectado; si el jugador de turno se desconecta, los demás cierran el turno 2 s después.
- **Barajar en el turno del rival:** se puede usar mientras el jugador de turno no haya volteado ninguna carta. Si ambos tocan casi al tiempo, Firebase acepta solo lo primero: si el de turno volteó antes, la barajada se rechaza y el poder no se gasta.
- La presencia usa `onDisconnect`: si alguien se cae, verás "Desconectado" y se salta su turno.
- **Hasta 4 jugadores:** quien crea la sala ve la lista de jugadores, y los demás entran con el código o el QR. Cada uno puede cambiar su nombre (máx. 8 letras) en la sala de espera. El creador toca **Empezar** cuando quiera (mínimo 2 conectados); los desconectados se quedan fuera y los asientos se renumeran. Una vez empezada, la sala se cierra a nuevos jugadores (los que ya estaban pueden reconectarse).
- **Poderes con varios rivales:** Congelar pide elegir a quién (toca su marcador). El Escudo del afectado lo bloquea; los demás poderes los bloquea el primer rival con Escudo, en orden de turno. El Espejo copia el último poder que usó otro jugador. Los turnos siguen el orden de asientos y se saltan a los desconectados y congelados.
- Estructura de la sala: `host`, `members{uid: asiento}`, `players{pN:{online,name}}`, `config`, `game{n, scores[n], ...}`.
- Las reglas (`database.rules.json`) solo dejan escribir en una sala a su creador y a sus miembros (o a quien entra mientras está en espera). **Después de actualizar tienes que publicar las reglas:** `firebase deploy --only database,hosting`.

Limitación conocida: el orden de las cartas está en la base de datos, así que alguien con las herramientas de desarrollador podría verlo. Evitarlo requiere Cloud Functions (plan Blaze).

## PWA (instalable y sin conexión)
- `www/manifest.webmanifest` + `www/icons/` + `www/sw.js` + `www/pwa.js`.
- Cada vez que cambies archivos del juego, sube `VERSION` en `www/sw.js` (por ejemplo `pcp-v2`) para que los celulares se actualicen.

## Apps iOS y Android (Capacitor)

Requisitos en tu Mac: Node 22+, Xcode (iOS), Android Studio (Android) y CocoaPods (`brew install cocoapods`).

```bash
npm run setup      # una sola vez: instala, crea ios/ y android/, genera iconos y splash
npm run ios        # copia www/ a la app y abre Xcode  → ▶ Run
npm run android    # copia www/ a la app y abre Android Studio → ▶ Run
```

- Cada vez que cambies algo en `www/`, vuelve a correr `npm run ios` o `npm run android` (copia el código y abre el proyecto).
- **Antes de `npm run setup`** revisa `appId` en `capacitor.config.json` (`com.boomduo.app`): debe ser único en las tiendas y no se cambia fácil después.
- En la app nativa no se usa el service worker (los archivos ya van dentro) y la vibración y "Compartir" usan los plugins nativos. El enlace de la sala apunta a la web publicada (`PUBLIC_URL` en `www/online.js`).
- Firebase funciona igual que en la web (inicio anónimo + Realtime Database).
- Pendiente para después: Universal Links / App Links para que el enlace `?sala=` abra la app, política de privacidad y ficha de las tiendas.

## Idiomas

El código está escrito en español y `www/i18n.js` traduce lo que se ve en pantalla con un diccionario (hoy: Español e English). El idioma se cambia en el engranaje (arriba a la derecha) y se guarda en el dispositivo. Para añadir otro idioma: agrega su nombre en `NAMES` y un diccionario en `DICT` dentro de `i18n.js` (copia `EN` y `R` y traduce). Si añades textos nuevos en español, agrégalos también al diccionario.
