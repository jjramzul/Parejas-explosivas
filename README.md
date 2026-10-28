# Parejas explosivas

Juego de memoria con poderes (antes "Parejas con poderes"): 2 jugadores en el mismo dispositivo, contra la máquina o **en línea de 2 a 4 jugadores** (Firebase).

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura: menú, sala en línea y juego |
| `styles.css` | Diseño, animaciones y responsive |
| `app.js` | Poderes, temas, tableros, lógica del juego e IA |
| `online.js` | Modo en línea: salas, código/QR, sincronización con Firebase |
| `audio.js` | Efectos de sonido y música generativa (Web Audio, sin archivos) |
| `firebase-config.js` | Datos del proyecto de Firebase (no es secreto) |
| `vendor/qrcode.js` | Generador de QR (qrcode-generator, licencia MIT) |
| `database.rules.json` | Reglas de seguridad de Realtime Database |
| `firebase.json`, `.firebaserc` | Configuración para publicar con Firebase Hosting |

## Probar en tu computador

- Local y contra la máquina: abre `index.html` directamente.
- En línea: ábrelo con **Live Server** de VS Code (`http://127.0.0.1:5500`) y usa dos **pestañas**: cada pestaña es un jugador distinto. Crea la sala en una y únete con el código en la otra.
  (Abriendo el archivo directo, `file://`, Firebase puede rechazar el inicio de sesión.)

## Publicar (necesario para que el QR funcione en otro celular)

```bash
npm install -g firebase-tools   # una sola vez
firebase login                  # una sola vez, con la cuenta dueña del proyecto
firebase deploy                 # en esta carpeta: publica el juego y las reglas
```

Queda en: https://parejas-explosivas.web.app

## Cómo funciona el modo en línea

- Cada jugador entra con **inicio de sesión anónimo** (sin registrarse).
- La sala vive en `rooms/CÓDIGO` de Realtime Database; ambos escuchan ese nodo.
- Cada jugada se escribe con una **transacción**, así dos toques al tiempo no rompen el estado.
- Visión, Imán y Brújula solo se muestran en la pantalla de quien los usa; Congelar, Escudo, Barajar, Intercambio, Cuarentena, Memoria corta y Espejo cambian el estado compartido (`quar`, `short`, `last` en `game`).
- Poderes (10, se juegan 3 por partida): Visión, Congelar (se usa en cualquier momento; si el rival aún no eligió carta en su turno, lo pierde de inmediato), Barajar, Imán (también con una carta ya volteada), Escudo (dura 1 ronda; se activa en cualquier momento, también en el turno del rival), Intercambio (se usa en cualquier momento, con cartas sin voltear), Brújula (voltea la carta elegida; también con una ya volteada), Espejo, Memoria corta (en tu turno, los demás ven las cartas que volteas la mitad del tiempo) y Cuarentena (se usa en cualquier momento; hasta tu siguiente turno).
- **Tiempo por jugada: 15 s** (`TURN_MS` en `online.js`). Se mide con la hora del servidor de Firebase, así ambos ven el mismo reloj. Si se acaba, el turno pasa al siguiente jugador conectado; si el jugador de turno se desconecta, los demás cierran el turno 2 s después.
- **Barajar en el turno del rival:** se puede usar mientras el jugador de turno no haya volteado ninguna carta. Si ambos tocan casi al tiempo, Firebase acepta solo lo primero: si el de turno volteó antes, la barajada se rechaza y el poder no se gasta.
- La presencia usa `onDisconnect`: si alguien se cae, verás "Desconectado" y se salta su turno.
- **Hasta 4 jugadores:** quien crea la sala ve la lista de jugadores, y los demás entran con el código o el QR. Cada uno puede cambiar su nombre (máx. 8 letras) en la sala de espera. El creador toca **Empezar** cuando quiera (mínimo 2 conectados); los desconectados se quedan fuera y los asientos se renumeran. Una vez empezada, la sala se cierra a nuevos jugadores (los que ya estaban pueden reconectarse).
- **Poderes con varios rivales:** Congelar pide elegir a quién (toca su marcador). El Escudo del afectado lo bloquea; los demás poderes los bloquea el primer rival con Escudo, en orden de turno. El Espejo copia el último poder que usó otro jugador. Los turnos siguen el orden de asientos y se saltan a los desconectados y congelados.
- Estructura de la sala: `host`, `members{uid: asiento}`, `players{pN:{online,name}}`, `config`, `game{n, scores[n], ...}`.
- Las reglas (`database.rules.json`) solo dejan escribir en una sala a su creador y a sus miembros (o a quien entra mientras está en espera). **Después de actualizar tienes que publicar las reglas:** `firebase deploy --only database,hosting`.

Limitación conocida: el orden de las cartas está en la base de datos, así que alguien con las herramientas de desarrollador podría verlo. Evitarlo requiere Cloud Functions (plan Blaze).

## PWA (instalable y sin conexión)
- `manifest.webmanifest` + `icons/` + `sw.js` + `pwa.js`.
- Cada vez que cambies archivos del juego, sube `VERSION` en `sw.js` (por ejemplo `pcp-v2`) para que los celulares se actualicen.
- Para Play Store: usar PWABuilder (pwabuilder.com) con la URL de Firebase Hosting y generar el paquete Android (TWA).