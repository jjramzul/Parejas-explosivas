# Parejas con poderes

Juego de memoria con poderes: 2 jugadores en el mismo dispositivo, contra la máquina o **en línea** (Firebase).

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura: menú, sala en línea y juego |
| `styles.css` | Diseño, animaciones y responsive |
| `app.js` | Poderes, temas, tableros, lógica del juego e IA |
| `online.js` | Modo en línea: salas, código/QR, sincronización con Firebase |
| `firebase-config.js` | Datos del proyecto de Firebase (no es secreto) |
| `vendor/qrcode.js` | Generador de QR (qrcode-generator, licencia MIT) |
| `database.rules.json` | Reglas de seguridad de Realtime Database |
| `firebase.json`, `.firebaserc` | Configuración para publicar con Firebase Hosting |

## Probar

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
- Visión e Imán solo se muestran en la pantalla de quien los usa; Congelar, Escudo y Barajar cambian el estado compartido.
- **Tiempo por jugada: 15 s** (`TURN_MS` en `online.js`). Se mide con la hora del servidor de Firebase, así ambos ven el mismo reloj. Si se acaba, el turno pasa al rival; si el jugador de turno se desconecta, el rival cierra el turno 2 s después.
- **Barajar en el turno del rival:** se puede usar mientras el rival no haya volteado ninguna carta. Si ambos tocan casi al tiempo, Firebase acepta solo lo primero: si el rival volteó antes, la barajada se rechaza y el poder no se gasta.
- La presencia usa `onDisconnect`: si tu rival se cae, verás "Desconectado".
- Las reglas solo dejan escribir en una sala a sus dos jugadores.

Limitación conocida: el orden de las cartas está en la base de datos, así que alguien con las herramientas de desarrollador podría verlo. Evitarlo requiere Cloud Functions (plan Blaze).