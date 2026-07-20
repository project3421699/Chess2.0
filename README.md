# Chess 2.0 — Online Multiplayer

A premium single-page web chess app with both offline AI play and online
multiplayer via Firebase Realtime Database. Designed for one-click deploy
to Vercel — your Firebase credentials stay safely in environment variables.

## Features

- Play against the Stockfish engine (4 difficulty levels) with a built-in
  JS fallback if the Web Worker is blocked.
- Local 2-Player on the same screen.
- Online multiplayer via Firebase RTDB: create a room and share a link like
  `https://your-app.vercel.app/?roomid=ABC123`.
- Five visually switchable themes (Classic, Gold, Neon, Forest, Ocean).
- Move history, captured-piece counts, check / checkmate / stalemate detection.
- Pawn promotion dialog, sound effects, board flip.

## File Structure

```
.
├── index.html              # The whole UI + game + multiplayer logic
├── package.json            # Node.js engine declaration for Vercel
├── api/
│   └── firebase-config.mjs # Serverless function that returns the
│                           #   Firebase config from env vars to the client
└── README.md               # This file
```

`index.html` is a fully self-contained static document. The only server
component is the tiny `/api/firebase-config` endpoint that hands Firebase
credentials to the client at runtime.

## Setup

### 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create
   a new project (any name).
2. In **Build → Realtime Database**, create a database. Pick any region.
3. In **Project settings → General → Your apps**, register a Web app and copy
   the config values:
   - `apiKey`
   - `authDomain`
   - `databaseURL`  ← must point at your RTDB instance (e.g. `https://<id>.firebaseio.com`)
   - `projectId`
   - `storageBucket` (optional)
   - `messagingSenderId` (optional)
   - `appId` (optional)

### 2. Set Firebase Realtime Database rules

In **Realtime Database → Rules**, paste:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> These rules are wide-open because there's no auth. Anyone with a room id
> can play. For production-grade work add rate-limiting + anonymous auth
> later.

Click **Publish**.

### 3. Add environment variables on Vercel

In your Vercel project (or `vercel.json` for local dev), add the following
**Production / Preview / Development** environment variables:

| Variable | Example |
| --- | --- |
| `FIREBASE_API_KEY` | `AIzaSy…` |
| `FIREBASE_AUTH_DOMAIN` | `your-app.firebaseapp.com` |
| `FIREBASE_DATABASE_URL` | `https://your-app-default-rtdb.firebaseio.com` |
| `FIREBASE_PROJECT_ID` | `your-app` |
| `FIREBASE_STORAGE_BUCKET` | `your-app.appspot.com` *(optional)* |
| `FIREBASE_MESSAGING_SENDER_ID` | `1234567890` *(optional)* |
| `FIREBASE_APP_ID` | `1:1234567890:web:abcdef` *(optional)* |

> Firebase config values are PUBLIC. Real security is enforced by the
> Firebase RTDB rules above. So storing them in Vercel env vars is a
> convenience for swap-and-redeploy workflows; it does NOT have to be a
> secret.

### 4. Deploy

```bash
# install vercel CLI once
npm i -g vercel

# from the project root
vercel              # first-time interactive setup
vercel --prod       # production deployment
```

Vercel will detect:
- `index.html` as a static file served at `/`
- `/api/*.js` files as serverless Node.js functions
- `package.json` to pick the right Node.js runtime

That's it. Your multiplayer chess is live.

## Usage

### Single player (vs AI)

1. Visit your deployed URL (no `?roomid=`).
2. Default mode is **Vs AI Bot**. Pick difficulty + color, then play.

### Two players on the same device

1. Choose **Local 2-Player** mode.

### Online multiplayer

1. Switch to **Online** mode.
2. Click **Create New Room** — you'll see a 6-character Room ID and a
   copyable share link.
3. Send that link to your opponent (any channel: chat, email, …).
4. When the opponent opens the link, they auto-join the same room as Black.
5. White plays first. Each move syncs over Firebase RTDB in real time.

After a game ends both players can click **Leave Room** to return to the
launcher state.

### URL parameters

`/?roomid=ABC123` — auto-joins (or creates if you've bookmarked your own
host link on a different device) the given room. Host opens with color
already assigned.

## Architecture Notes

- **No Firebase auth.** Each browser generates a UUID per first-visit and
  stores it in `localStorage` (`chess_player_id`). This is used to detect
  "this is me" vs "this is the opponent" when reading the two player slots
  in a room node.
- **Disconnection cleanup.** On `onDisconnect()` the slot a player holds
  (`rooms/<id>/players/w` or `players/b`) is auto-removed, freeing the
  room for rejoin. The room itself is left intact so the game in progress
  is recoverable.
- **Move sync.** Every move is pushed to `rooms/<id>/moves/<pushKey>`.
  Each client subscribes via `child_added`. Local moves are skipped
  during echo because `mv.playerId` matches our player id.
- **Game-over.** The client that delivers the final move also flips
  `status` to `finished` (with a `result`), and the other side's local
  chess.js state already reflects game-over so the same modal pops up.

## Disabling scrolling inside the chess board

Already enabled in `index.html`:

- `.board-container { overflow: hidden; overscroll-behavior: contain; }` —
  stops visual scroll inside the board wrapper.
- `#board { touch-action: none; user-select: none; -webkit-touch-callout: none; }` —
  stops browser-level touch gestures (pinch, double-tap zoom,
  pull-to-refresh) while interacting with pieces.
- `body { overflow-x: hidden; }` — already present, prevents horizontal
  scroll of the page when content is slightly wider than viewport.

## Tech Stack

- Chess engine: Stockfish 10.0.2 (Web Worker) + minimax fallback in JS
- UI: chessboard.js 1.0.0 + jQuery 3.6
- Move validation: chess.js 0.10.3
- Multiplayer: Firebase 10.7.1 compat SDK
- Theme tokens: hand-coded CSS variables + Font Awesome 6 / Outfit font

## License

MIT — do whatever, just don't blame me for blunders.
