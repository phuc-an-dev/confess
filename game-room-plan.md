# Game Room — Project Plan

## Overview

A mobile-first web game where players join a room, optionally write questions, then take turns answering randomly drawn questions from the pool. While one player answers, everyone else reacts in real-time with meme images. The host controls game flow.

**Design language:** Flat, black & white, no gradients  
**Language:** English  
**Priority:** Clean code → Beautiful UI → Full features → Ship speed  
**Context:** Solo dev, side project, no deadline  
**Development methodology:** Test-first (TDD) — write failing tests before implementation

---

## Tech Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React + Vite + Tailwind + shadcn | Netlify (free) |
| Backend | Node.js + Express + Socket.io | Render (free) |
| Database | MongoDB Atlas | Atlas free tier (512MB) |
| State (client) | React Context + useState | — |
| QR Code | qrcode.react | — |
| Routing | react-router-dom | — |
| Testing | Vitest (client + server) | — |
| Socket testing | socket.io-client (in-process) | — |

> **Why Context over Zustand:** Game state is linear (lobby → writing → playing → ended). Context + useState is sufficient and has zero extra dependency. Add Zustand later if state gets complex.

> **Why Socket.io over raw WebSocket:** Handles reconnection and polling fallback (important for mobile). Room-based broadcasting built in.

> **Why Render over Netlify for backend:** Netlify is static + serverless only. Express + Socket.io requires a persistent process. Render free tier cold-starts after 15min inactivity — acceptable for a party game started intentionally.

---

## Architecture

```
Browser (React)
    │
    ├── REST (HTTP)        POST /rooms, GET /rooms/:code
    │
    └── WebSocket          Socket.io bidirectional events

          ↓

Express Server (Render)
    │
    ├── REST routes        Room creation & lookup
    ├── Socket.io server   Game state orchestration
    └── Mongoose           MongoDB Atlas connection

          ↓

MongoDB Atlas
    └── rooms collection   Single collection, TTL auto-delete
```

---

## Game Flow

```
Create room (host) / Join room (players)
    ↓
Lobby — QR code, player list
    ↓
Writing phase — players OPTIONALLY submit up to 3 questions
    · Shows checkmark per player who has submitted
    · Host can start at any time IF pool is not empty
    · Host cannot start if zero questions submitted
    ↓
Playing phase — turns go in shuffled order through all players
    · Each turn: server picks a random unused question from pool
    · All screens show: current player name + question (large, readable)
    · ALL players see meme picker (including current player)
    · Memes float up on ALL players' screens in real-time (with sender name)
    · Client throttles meme sends: 300ms cooldown between sends
    · Host: ALWAYS sees "Next" button regardless of whose turn it is
    · Pool exhausted → game ends immediately
    ↓
Results — final screen, room auto-deleted
```

---

## Host System

- Player who creates the room is the host. **Host role is fixed — no transfer.**
- If the host disconnects, host is automatically assigned to the next player in the list.
- Host privileges:
  - Start the game (writing → playing)
  - Always sees the "Next" button

> **Why no host transfer:** 2-4 players sitting together in the same room. If the host needs to pass control, they say it out loud. The complexity isn't worth it.

---

## Player Identity & Reconnection

Players have no account. Identity is tracked via a `sessionToken` stored in `localStorage`.

```js
// client/src/lib/session.js
export function getSessionToken() {
  let token = localStorage.getItem('sessionToken')
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem('sessionToken', token)
  }
  return token
}
```

On every `room:join` emit, the client sends `{ code, playerName, sessionToken }`. The server uses `sessionToken` to find and re-link a disconnected player slot instead of creating a new one.

### Late join & rejoin rules

| Situation | Behaviour |
|---|---|
| Join during lobby | Normal — added to player list and turn order |
| Join during writing phase | Added to player list, can still submit questions |
| Join during playing phase | Spectator only — sees the game but not in turn order |
| Rejoin (same sessionToken) | Re-linked to existing player slot, resumes as that player |

---

## MongoDB Data Model

### Room document

```js
{
  _id: ObjectId,
  code: String,              // "ABCXYZ" — 6 uppercase letters only (avoids 0/O, 1/I confusion)
  status: String,            // "lobby" | "writing" | "playing" | "ended"
  hostSessionToken: String,  // sessionToken of the host

  players: [
    {
      sessionToken: String,  // stable identity across reconnects
      socketId: String,      // current socket.id, updated on reconnect
      name: String,
      submittedQuestions: Boolean,
      isSpectator: Boolean   // true if joined during playing phase
    }
  ],

  questions: [
    {
      id: ObjectId,
      authorSessionToken: String,
      text: String,
      type: String,          // "serious" | "fun" | "normal"
      used: Boolean
    }
  ],

  turnOrder: [String],       // array of sessionTokens, shuffled at game start
  currentTurnIndex: Number,
  currentQuestion: ObjectId,

  createdAt: Date            // TTL index: auto-delete 2h after creation
}
```

> No score fields — no voting system. Meme reactions are ephemeral, never stored.

### Indexes

```js
db.rooms.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7200 })
db.rooms.createIndex({ code: 1 }, { unique: true })
```

### Room code format

```js
// server/src/lib/codeGenerator.js
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I, O to avoid confusion with 1, 0
export function generateCode() {
  return Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}
```

---

## REST API Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/rooms` | Create a new room, returns `{ code, roomId }` |
| `GET` | `/api/rooms/:code` | Check if room exists and get its status |

---

## Socket.io Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `room:join` | `{ code, playerName, sessionToken }` | Join or rejoin a room |
| `room:start` | `{ code, sessionToken }` | Host starts game (blocked if pool empty) |
| `question:submit` | `{ code, sessionToken, questions: [{text, type}] }` | Player submits questions (optional) |
| `round:next` | `{ code, sessionToken }` | Host advances to next turn |
| `meme:send` | `{ code, sessionToken, memeId }` | Send a meme reaction |

### Server → Client (broadcast to room)

| Event | Payload | Description |
|---|---|---|
| `room:updated` | `{ room }` | Full room state on any change |
| `question:random` | `{ question, currentPlayerName }` | New turn started |
| `meme:broadcast` | `{ memeId, senderName }` | Meme sent to all players |
| `game:end` | `{ message }` | Pool exhausted, game over |

### Game loop (server-side)

```
host emits round:next
  → pick random question where used === false
  → if none → broadcast game:end → delete room
  → mark question.used = true
  → advance currentTurnIndex
  → broadcast question:random

player emits meme:send
  → validate sessionToken exists in room
  → broadcast meme:broadcast to entire room (including sender)

host disconnects
  → find next connected player in players[]
  → assign hostSessionToken
  → broadcast room:updated
```

---

## Meme System

50 meme images stored as static assets in the client bundle. Only the ID is sent over the socket — image resolved client-side.

```
client/public/memes/
  meme-01.jpg … meme-50.jpg
```

```js
// client/src/lib/memes.js
export const MEMES = Array.from({ length: 50 }, (_, i) => ({
  id: `meme-${String(i + 1).padStart(2, '0')}`,
  src: `/memes/meme-${String(i + 1).padStart(2, '0')}.jpg`,
}))
```

### Client-side throttle

```js
// Inside MemeGrid component
const lastSentAt = useRef(0)

function sendMeme(memeId) {
  const now = Date.now()
  if (now - lastSentAt.current < 300) return  // 300ms cooldown
  lastSentAt.current = now
  socket.emit('meme:send', { code, sessionToken, memeId })
}
```

---

## Project Structure

```
/
├── client/
│   ├── public/
│   │   └── memes/              # 50 static meme images
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx            # Enter name, create or join room
│   │   │   ├── Lobby.jsx           # QR code + player list + submit status
│   │   │   ├── WriteQuestions.jsx  # Optional: up to 3 questions
│   │   │   ├── Playing.jsx         # Question card + meme panel + host Next button
│   │   │   └── Results.jsx         # Game over screen
│   │   ├── components/
│   │   │   ├── QRCard.jsx          # QR + room code display
│   │   │   ├── PlayerList.jsx      # Players with checkmarks + host badge
│   │   │   ├── QuestionCard.jsx    # Large player name + question text
│   │   │   ├── MemeGrid.jsx        # 50-meme picker (all players, throttled)
│   │   │   ├── MemeFloat.jsx       # Floating meme animation + sender name
│   │   │   └── HostControls.jsx    # Next button (host only)
│   │   ├── context/
│   │   │   └── GameContext.jsx     # React Context: room state + dispatch
│   │   ├── hooks/
│   │   │   └── useSocket.js        # All socket listeners in one place
│   │   └── lib/
│   │       ├── socket.js           # socket.io-client singleton
│   │       ├── session.js          # sessionToken read/write from localStorage
│   │       └── memes.js            # MEMES constant array
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── server/
    ├── src/
    │   ├── routes/
    │   │   └── rooms.js
    │   ├── socket/
    │   │   ├── index.js            # io.on('connection') + register handlers
    │   │   ├── roomHandlers.js     # room:join, room:start
    │   │   └── gameHandlers.js     # question:submit, round:next, meme:send
    │   ├── models/
    │   │   └── Room.js
    │   ├── lib/
    │   │   ├── codeGenerator.js    # uppercase-only 6-char code
    │   │   └── gameLogic.js        # pure functions: pickQuestion, nextHost, advanceTurn, isPoolExhausted
    │   └── app.js
    ├── test/
    │   ├── setup.js
    │   ├── unit/
    │   │   └── gameLogic.test.js
    │   ├── integration/
    │   │   └── rooms.api.test.js
    │   └── socket/
    │       ├── roomHandlers.test.js
    │       └── gameHandlers.test.js
    ├── vitest.config.js
    ├── .env.example
    └── package.json
```

---

## Testing Strategy

### Philosophy: Test-First (TDD)

Write the failing test first. Do not write implementation code until the test is confirmed RED.

```
RED   → write test, run vitest, confirm it fails
GREEN → write minimum code to make it pass
REFACTOR → clean up, run again, still green
```

**Why TDD even as a beginner:** Pure functions like `pickRandomQuestion` and `getNextHost` are the easiest place to start — no server, no socket, just input → output. Starting there builds the habit before tackling the harder socket tests.

### Coverage target

Critical paths only:
- Game loop (question picking, turn advancement, pool exhaustion)
- Host auto-transfer on disconnect
- Room guards (empty pool block, unknown code, spectator on late join)
- Reconnection via sessionToken

---

### Test Setup

#### `vitest.config.js`

```js
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.js'],
  },
})
```

#### `test/setup.js`

```js
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterEach(async () => {
  await mongoose.connection.db.dropDatabase()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})
```

---

### Unit Tests — `gameLogic.test.js`

```js
import { describe, it, expect } from 'vitest'
import {
  pickRandomQuestion,
  isPoolExhausted,
  advanceTurn,
  getNextHost,
} from '../../src/lib/gameLogic.js'

describe('pickRandomQuestion', () => {
  it('returns only from unused questions', () => {
    const questions = [
      { id: '1', used: false },
      { id: '2', used: true },
      { id: '3', used: false },
    ]
    const result = pickRandomQuestion(questions)
    expect(['1', '3']).toContain(result.id)
  })

  it('returns null when all used', () => {
    expect(pickRandomQuestion([{ id: '1', used: true }])).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(pickRandomQuestion([])).toBeNull()
  })
})

describe('isPoolExhausted', () => {
  it('true when all questions used', () => {
    expect(isPoolExhausted([{ used: true }, { used: true }])).toBe(true)
  })

  it('false when at least one unused', () => {
    expect(isPoolExhausted([{ used: true }, { used: false }])).toBe(false)
  })

  it('true for empty pool', () => {
    expect(isPoolExhausted([])).toBe(true)
  })
})

describe('advanceTurn', () => {
  it('increments index by 1', () => {
    expect(advanceTurn(0)).toBe(1)
    expect(advanceTurn(3)).toBe(4)
  })
})

describe('getNextHost', () => {
  it('returns next player sessionToken', () => {
    const players = [
      { sessionToken: 's1' },
      { sessionToken: 's2' },
      { sessionToken: 's3' },
    ]
    expect(getNextHost('s1', players)).toBe('s2')
  })

  it('wraps to first if current host is last', () => {
    const players = [{ sessionToken: 's1' }, { sessionToken: 's2' }]
    expect(getNextHost('s2', players)).toBe('s1')
  })

  it('returns null if only one player', () => {
    expect(getNextHost('s1', [{ sessionToken: 's1' }])).toBeNull()
  })
})
```

---

### Integration Tests — `rooms.api.test.js`

```js
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app.js'

describe('POST /api/rooms', () => {
  it('returns a 6-char uppercase code', async () => {
    const res = await request(app).post('/api/rooms').send({ hostName: 'Alice' })
    expect(res.status).toBe(201)
    expect(res.body.code).toMatch(/^[A-Z]{6}$/)
  })

  it('returns 400 if hostName missing', async () => {
    const res = await request(app).post('/api/rooms').send({})
    expect(res.status).toBe(400)
  })
})

describe('GET /api/rooms/:code', () => {
  it('returns lobby status for valid code', async () => {
    const { body } = await request(app).post('/api/rooms').send({ hostName: 'Alice' })
    const res = await request(app).get(`/api/rooms/${body.code}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('lobby')
  })

  it('returns 404 for unknown code', async () => {
    const res = await request(app).get('/api/rooms/XXXXXX')
    expect(res.status).toBe(404)
  })
})
```

---

### Socket Tests — `roomHandlers.test.js`

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as Client } from 'socket.io-client'
import { registerHandlers } from '../../src/socket/index.js'
import Room from '../../src/models/Room.js'

let httpServer, ioServer, port

beforeEach(async () => {
  httpServer = createServer()
  ioServer = new Server(httpServer)
  registerHandlers(ioServer)
  await new Promise(resolve => httpServer.listen(0, resolve))
  port = httpServer.address().port
})

afterEach(() => new Promise(resolve => ioServer.close(resolve)))

function connect() {
  return new Promise(resolve => {
    const s = Client(`http://localhost:${port}`)
    s.on('connect', () => resolve(s))
  })
}

describe('room:join', () => {
  it('adds player and broadcasts room:updated', async () => {
    await Room.create({
      code: 'ABCDEF', status: 'lobby', hostSessionToken: 'host-token',
      players: [], questions: [], turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    const updated = await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('room:join', { code: 'ABCDEF', playerName: 'Alice', sessionToken: 'alice-token' })
    })
    expect(updated.room.players[0].name).toBe('Alice')
    socket.disconnect()
  })

  it('re-links existing player on reconnect (same sessionToken)', async () => {
    await Room.create({
      code: 'REJOIN', status: 'playing', hostSessionToken: 'host-token',
      players: [{ sessionToken: 'alice-token', socketId: 'old-id', name: 'Alice', submittedQuestions: false, isSpectator: false }],
      questions: [], turnOrder: ['alice-token'], currentTurnIndex: 0,
    })
    const socket = await connect()
    const updated = await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('room:join', { code: 'REJOIN', playerName: 'Alice', sessionToken: 'alice-token' })
    })
    expect(updated.room.players).toHaveLength(1) // not duplicated
    expect(updated.room.players[0].socketId).not.toBe('old-id') // updated
    socket.disconnect()
  })

  it('marks late joiner as spectator during playing phase', async () => {
    await Room.create({
      code: 'LATE01', status: 'playing', hostSessionToken: 'host-token',
      players: [], questions: [], turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    const updated = await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('room:join', { code: 'LATE01', playerName: 'Late', sessionToken: 'late-token' })
    })
    const late = updated.room.players.find(p => p.name === 'Late')
    expect(late.isSpectator).toBe(true)
    socket.disconnect()
  })

  it('emits error for unknown room code', async () => {
    const socket = await connect()
    const error = await new Promise(resolve => {
      socket.on('error', resolve)
      socket.emit('room:join', { code: 'XXXXXX', playerName: 'Alice', sessionToken: 'token' })
    })
    expect(error.message).toMatch(/not found/i)
    socket.disconnect()
  })
})
```

---

### Socket Tests — `gameHandlers.test.js`

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as Client } from 'socket.io-client'
import { registerHandlers } from '../../src/socket/index.js'
import Room from '../../src/models/Room.js'

let httpServer, ioServer, port
beforeEach(async () => {
  httpServer = createServer()
  ioServer = new Server(httpServer)
  registerHandlers(ioServer)
  await new Promise(resolve => httpServer.listen(0, resolve))
  port = httpServer.address().port
})
afterEach(() => new Promise(resolve => ioServer.close(resolve)))
function connect() {
  return new Promise(resolve => {
    const s = Client(`http://localhost:${port}`)
    s.on('connect', () => resolve(s))
  })
}

describe('room:start', () => {
  it('blocks start when pool is empty', async () => {
    await Room.create({
      code: 'EMPTY1', status: 'writing', hostSessionToken: 'seed',
      players: [], questions: [], turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await new Promise(resolve => { socket.on('room:updated', resolve); socket.emit('room:join', { code: 'EMPTY1', playerName: 'Host', sessionToken: 'seed' }) })
    const error = await new Promise(resolve => {
      socket.on('error', resolve)
      socket.emit('room:start', { code: 'EMPTY1', sessionToken: 'seed' })
    })
    expect(error.message).toMatch(/no questions/i)
    socket.disconnect()
  })

  it('transitions to playing when pool has questions', async () => {
    await Room.create({
      code: 'FULL01', status: 'writing', hostSessionToken: 'seed',
      players: [],
      questions: [{ text: 'Q1', type: 'fun', used: false, authorSessionToken: 'seed' }],
      turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await new Promise(resolve => { socket.on('room:updated', resolve); socket.emit('room:join', { code: 'FULL01', playerName: 'Host', sessionToken: 'seed' }) })
    const updated = await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('room:start', { code: 'FULL01', sessionToken: 'seed' })
    })
    expect(updated.room.status).toBe('playing')
    socket.disconnect()
  })
})

describe('round:next', () => {
  it('broadcasts question:random with an unused question', async () => {
    await Room.create({
      code: 'NEXT01', status: 'playing', hostSessionToken: 'seed',
      players: [{ sessionToken: 'seed', socketId: 'x', name: 'Host', submittedQuestions: false, isSpectator: false }],
      questions: [
        { text: 'Q1', type: 'fun', used: false, authorSessionToken: 'seed' },
        { text: 'Q2', type: 'serious', used: false, authorSessionToken: 'seed' },
      ],
      turnOrder: ['seed'], currentTurnIndex: 0,
    })
    const socket = await connect()
    await new Promise(resolve => { socket.on('room:updated', resolve); socket.emit('room:join', { code: 'NEXT01', playerName: 'Host', sessionToken: 'seed' }) })
    const event = await new Promise(resolve => {
      socket.on('question:random', resolve)
      socket.emit('round:next', { code: 'NEXT01', sessionToken: 'seed' })
    })
    expect(event.question.text).toMatch(/Q[12]/)
    socket.disconnect()
  })

  it('emits game:end when pool is exhausted', async () => {
    await Room.create({
      code: 'DONE01', status: 'playing', hostSessionToken: 'seed',
      players: [{ sessionToken: 'seed', socketId: 'x', name: 'Host', submittedQuestions: false, isSpectator: false }],
      questions: [{ text: 'Q1', type: 'fun', used: true, authorSessionToken: 'seed' }],
      turnOrder: ['seed'], currentTurnIndex: 0,
    })
    const socket = await connect()
    await new Promise(resolve => { socket.on('room:updated', resolve); socket.emit('room:join', { code: 'DONE01', playerName: 'Host', sessionToken: 'seed' }) })
    const event = await new Promise(resolve => {
      socket.on('game:end', resolve)
      socket.emit('round:next', { code: 'DONE01', sessionToken: 'seed' })
    })
    expect(event).toBeDefined()
    socket.disconnect()
  })
})

describe('meme:send', () => {
  it('broadcasts meme:broadcast with memeId and senderName to all players', async () => {
    await Room.create({
      code: 'MEME01', status: 'playing', hostSessionToken: 'seed',
      players: [],
      questions: [{ text: 'Q1', type: 'fun', used: false, authorSessionToken: 'x' }],
      turnOrder: [], currentTurnIndex: 0,
    })
    const sender = await connect()
    const receiver = await connect()
    await new Promise(resolve => { sender.on('room:updated', resolve); sender.emit('room:join', { code: 'MEME01', playerName: 'Alice', sessionToken: 'alice-token' }) })
    await new Promise(resolve => { receiver.on('room:updated', resolve); receiver.emit('room:join', { code: 'MEME01', playerName: 'Bob', sessionToken: 'bob-token' }) })
    const received = await new Promise(resolve => {
      receiver.on('meme:broadcast', resolve)
      sender.emit('meme:send', { code: 'MEME01', sessionToken: 'alice-token', memeId: 'meme-07' })
    })
    expect(received.memeId).toBe('meme-07')
    expect(received.senderName).toBe('Alice')
    sender.disconnect()
    receiver.disconnect()
  })
})
```

---

## Dependencies

### Client

```bash
npm install socket.io-client qrcode.react react-router-dom
npm install -D tailwindcss @tailwindcss/vite vitest @vitest/coverage-v8
```

shadcn components: `button`, `input`, `card`, `badge`, `separator`

### Server

```bash
npm install express socket.io mongoose cors dotenv
npm install -D vitest @vitest/coverage-v8 mongodb-memory-server supertest nodemon
```

---

## Environment Variables

### Server `.env`

```
MONGODB_URI=mongodb+srv://...
PORT=3001
CLIENT_URL=https://your-app.netlify.app
```

### Client `.env`

```
VITE_SERVER_URL=https://your-server.onrender.com
```

---

## Implementation Phases

> **Rule:** Write the failing test first. Confirm RED. Then implement until GREEN. Then refactor.

### Phase 0 — Test infrastructure
- [ ] Install Vitest + mongodb-memory-server + supertest on server
- [ ] Create `test/setup.js` with MongoMemoryServer lifecycle
- [ ] Create `vitest.config.js`
- [ ] Confirm `vitest run` exits clean with 0 tests (baseline)
- [ ] Write all tests in `gameLogic.test.js` → confirm RED
- [ ] Write all tests in `rooms.api.test.js` → confirm RED
- [ ] Write all tests in `roomHandlers.test.js` → confirm RED
- [ ] Write all tests in `gameHandlers.test.js` → confirm RED

### Phase 1 — Pure logic (unit tests green)
- [ ] Implement `gameLogic.js`: `pickRandomQuestion`, `isPoolExhausted`, `advanceTurn`, `getNextHost`
- [ ] `gameLogic.test.js` → all GREEN

### Phase 2 — REST API (integration tests green)
- [ ] `Room` Mongoose model with TTL + code indexes
- [ ] `codeGenerator.js` with uppercase-only chars
- [ ] `POST /api/rooms` + `GET /api/rooms/:code`
- [ ] `rooms.api.test.js` → all GREEN
- [ ] Scaffold Express + Socket.io `app.js`

### Phase 3 — Room join & host (roomHandlers tests green)
- [ ] `room:join` handler with sessionToken re-link logic
- [ ] Spectator flag for late joiners during playing phase
- [ ] Auto host transfer on disconnect
- [ ] `roomHandlers.test.js` → all GREEN
- [ ] Home page — enter name, create room, join by code
- [ ] Lobby page — player list with checkmarks + host badge

### Phase 4 — Game loop (gameHandlers tests green)
- [ ] `question:submit` handler
- [ ] `room:start` handler (guard: block if pool empty)
- [ ] `round:next` handler (pick → advance → end if exhausted)
- [ ] `meme:send` → `meme:broadcast` handler
- [ ] `gameHandlers.test.js` → all GREEN
- [ ] WriteQuestions page — optional, up to 3 questions
- [ ] Playing page — QuestionCard + MemeGrid + MemeFloat + HostControls

### Phase 5 — UI polish
- [ ] QR code in lobby (links to `/?join=CODE`)
- [ ] Auto-join from URL param on Home page
- [ ] Flat black & white design across all pages
- [ ] Mobile-first layout (375px base)
- [ ] QuestionCard uses large font — readable from arm's length (offline party use case)
- [ ] Meme float animation: upward drift + fade ~2s, sender name visible
- [ ] Client-side meme throttle: 300ms cooldown
- [ ] Question type badge (serious / fun / normal)
- [ ] Smooth phase transitions

### Phase 6 — Resilience & deploy
- [ ] Client reads `sessionToken` from localStorage on load, sends on every emit
- [ ] Room not found / game already ended error states
- [ ] Netlify `_redirects` for SPA routing
- [ ] Render + Netlify deploy with env vars
- [ ] MongoDB Atlas network access + connection string
- [ ] End-to-end test: full game session on mobile with 3+ people

---

## Key Design Decisions

| Decision | Reasoning |
|---|---|
| No host transfer | 2-4 players in same room, verbal handoff is sufficient |
| No voting/scoring | Memes are the reaction — keeping it simple and fun |
| Context over Zustand | Linear game state doesn't need Zustand complexity |
| sessionToken in localStorage | Stable identity across socket reconnects |
| Uppercase-only room codes | Avoids 0/O and 1/I confusion when sharing verbally |
| Spectators for late joiners | Simpler than inserting mid-game into turn order |
| Pool exhaustion = immediate end | Predictable, no edge cases from partial rounds |
| Meme throttle client-side | Prevents UI lag from spam, no server logic needed |
| TDD from Phase 0 | Pure functions first — easiest entry point for TDD beginners |

### Room lifecycle

```
Create → lobby → writing → playing → ended → (deleted on game:end or TTL 2h)
```
