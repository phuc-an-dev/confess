# Phase 4 — Start Game & Writing Phase

## Flow this phase covers

```
lobby (status: "lobby")
    ↓ host bấm "Start Writing" → emit room:writing
writing (status: "writing")
    ↓ players tùy ý submit questions → emit question:submit
    ↓ host bấm "Start Playing" → emit room:start  ← blocked nếu pool rỗng
playing (status: "playing")
```

Two distinct host actions, two distinct server events, three DB statuses.

---

## Events this phase introduces

| Event (Client → Server) | Payload | Description |
|---|---|---|
| `room:writing` | `{ code, sessionToken }` | Host moves lobby → writing |
| `question:submit` | `{ code, sessionToken, questions: [{text, type}] }` | Player submits questions (optional) |
| `room:start` | `{ code, sessionToken }` | Host moves writing → playing (blocked if pool empty) |

> `room:writing` and `room:start` are **separate events**. Do not reuse one event for both transitions — the server guard logic is different (only `room:start` checks pool size).

---

## Server changes

### `server/src/socket/gameHandlers.js`

Add three new listeners:

**`room:writing`**
- Validate sender `sessionToken === room.hostSessionToken` → else emit `error`
- Validate `room.status === 'lobby'` → else emit `error`
- Set `room.status = 'writing'`
- Broadcast `room:updated`

**`question:submit`**
- Find room by code
- Find player by `sessionToken`
- Validate player is not a spectator → else ignore
- Store questions on the room's `questions` array (append, not replace)
- Set `player.submittedQuestions = true`
- Broadcast `room:updated` (so all clients see the checkmark update)

**`room:start`**
- Validate sender `sessionToken === room.hostSessionToken` → else emit `error`
- Validate `room.status === 'writing'` → else emit `error`
- Validate `room.questions.some(q => !q.used)` → else emit `error` with "no questions"
- Shuffle players into `turnOrder` (exclude spectators)
- Set `room.status = 'playing'`
- Broadcast `room:updated`

### `server/src/models/Room.js`

No changes needed — `questions` array and `submittedQuestions` boolean already exist in the schema from the master plan.

---

## Client changes

### `client/src/context/GameContext.jsx`

Add two functions:

```js
function startWriting() {
  socket.emit('room:writing', { code: room.code, sessionToken })
}

function submitQuestions(questions) {
  socket.emit('question:submit', { code: room.code, sessionToken, questions })
}

function startPlaying() {
  socket.emit('room:start', { code: room.code, sessionToken })
}
```

> `startGame` from the original Phase 4 proposal is renamed to `startWriting` and `startPlaying` — two functions, not one.

### `client/src/pages/Lobby.jsx`

- "Start Writing" button calls `startWriting()` — visible only to host
- Redirect to `/writing` when `room.status === 'writing'` (useEffect watching room.status)

### `client/src/pages/WriteQuestions.jsx`

- Local state for 3 question inputs (type: serious / fun / normal)
- Submit button calls `submitQuestions(questions)`
- After submit: show "Waiting..." state — do NOT auto-advance, wait for `room:updated` with `status === 'playing'`
- "Start Playing" button calls `startPlaying()` — visible only to host, always present regardless of who has submitted
- Redirect to `/playing` when `room.status === 'playing'` (useEffect watching room.status)

---

## Tests — write these first, confirm RED before any implementation

### `server/test/socket/gameHandlers.test.js` — add these blocks

```js
// ─── room:writing ───────────────────────────────────────────

describe('room:writing', () => {
  it('transitions lobby → writing when called by host', async () => {
    await Room.create({
      code: 'WRT001', status: 'lobby', hostSessionToken: 'host-token',
      players: [], questions: [], turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await joinRoom(socket, 'WRT001', 'Host', 'host-token')

    const updated = await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('room:writing', { code: 'WRT001', sessionToken: 'host-token' })
    })
    expect(updated.room.status).toBe('writing')
    socket.disconnect()
  })

  it('emits error when called by non-host', async () => {
    await Room.create({
      code: 'WRT002', status: 'lobby', hostSessionToken: 'host-token',
      players: [], questions: [], turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await joinRoom(socket, 'WRT002', 'Guest', 'guest-token')

    const error = await new Promise(resolve => {
      socket.on('error', resolve)
      socket.emit('room:writing', { code: 'WRT002', sessionToken: 'guest-token' })
    })
    expect(error.message).toMatch(/not host/i)
    socket.disconnect()
  })

  it('emits error when room is not in lobby status', async () => {
    await Room.create({
      code: 'WRT003', status: 'writing', hostSessionToken: 'host-token',
      players: [], questions: [], turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await joinRoom(socket, 'WRT003', 'Host', 'host-token')

    const error = await new Promise(resolve => {
      socket.on('error', resolve)
      socket.emit('room:writing', { code: 'WRT003', sessionToken: 'host-token' })
    })
    expect(error.message).toMatch(/invalid status/i)
    socket.disconnect()
  })
})

// ─── question:submit ─────────────────────────────────────────

describe('question:submit', () => {
  it('stores questions and marks player as submitted', async () => {
    await Room.create({
      code: 'QST001', status: 'writing', hostSessionToken: 'host-token',
      players: [{ sessionToken: 'host-token', socketId: 'x', name: 'Host', submittedQuestions: false, isSpectator: false }],
      questions: [], turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await joinRoom(socket, 'QST001', 'Host', 'host-token')

    const updated = await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('question:submit', {
        code: 'QST001',
        sessionToken: 'host-token',
        questions: [
          { text: 'Serious Q', type: 'serious' },
          { text: 'Fun Q', type: 'fun' },
          { text: 'Normal Q', type: 'normal' },
        ],
      })
    })

    const player = updated.room.players.find(p => p.sessionToken === 'host-token')
    expect(player.submittedQuestions).toBe(true)
    expect(updated.room.questions).toHaveLength(3)
    socket.disconnect()
  })

  it('ignores submission from spectator', async () => {
    await Room.create({
      code: 'QST002', status: 'writing', hostSessionToken: 'host-token',
      players: [{ sessionToken: 'spec-token', socketId: 'x', name: 'Spec', submittedQuestions: false, isSpectator: true }],
      questions: [], turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await joinRoom(socket, 'QST002', 'Spec', 'spec-token')

    // emit and wait briefly — should NOT trigger room:updated with new questions
    await new Promise(resolve => setTimeout(resolve, 100))
    socket.emit('question:submit', {
      code: 'QST002',
      sessionToken: 'spec-token',
      questions: [{ text: 'Q', type: 'fun' }],
    })
    await new Promise(resolve => setTimeout(resolve, 100))

    const room = await Room.findOne({ code: 'QST002' })
    expect(room.questions).toHaveLength(0)
    socket.disconnect()
  })

  it('does NOT auto-advance to playing when all players submit', async () => {
    // Writing phase advance is host-controlled, not automatic
    await Room.create({
      code: 'QST003', status: 'writing', hostSessionToken: 'host-token',
      players: [{ sessionToken: 'host-token', socketId: 'x', name: 'Host', submittedQuestions: false, isSpectator: false }],
      questions: [], turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await joinRoom(socket, 'QST003', 'Host', 'host-token')

    const updated = await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('question:submit', {
        code: 'QST003',
        sessionToken: 'host-token',
        questions: [{ text: 'Q', type: 'fun' }],
      })
    })
    // Status must remain 'writing' — host has not pressed Start Playing yet
    expect(updated.room.status).toBe('writing')
    socket.disconnect()
  })
})

// ─── room:start ──────────────────────────────────────────────

describe('room:start', () => {
  it('transitions writing → playing when pool has questions', async () => {
    await Room.create({
      code: 'STR001', status: 'writing', hostSessionToken: 'host-token',
      players: [{ sessionToken: 'host-token', socketId: 'x', name: 'Host', submittedQuestions: true, isSpectator: false }],
      questions: [{ text: 'Q1', type: 'fun', used: false, authorSessionToken: 'host-token' }],
      turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await joinRoom(socket, 'STR001', 'Host', 'host-token')

    const updated = await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('room:start', { code: 'STR001', sessionToken: 'host-token' })
    })
    expect(updated.room.status).toBe('playing')
    socket.disconnect()
  })

  it('blocks start when pool is empty', async () => {
    await Room.create({
      code: 'STR002', status: 'writing', hostSessionToken: 'host-token',
      players: [], questions: [], turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await joinRoom(socket, 'STR002', 'Host', 'host-token')

    const error = await new Promise(resolve => {
      socket.on('error', resolve)
      socket.emit('room:start', { code: 'STR002', sessionToken: 'host-token' })
    })
    expect(error.message).toMatch(/no questions/i)
    socket.disconnect()
  })

  it('emits error when called by non-host', async () => {
    await Room.create({
      code: 'STR003', status: 'writing', hostSessionToken: 'host-token',
      players: [],
      questions: [{ text: 'Q1', type: 'fun', used: false, authorSessionToken: 'host-token' }],
      turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await joinRoom(socket, 'STR003', 'Guest', 'guest-token')

    const error = await new Promise(resolve => {
      socket.on('error', resolve)
      socket.emit('room:start', { code: 'STR003', sessionToken: 'guest-token' })
    })
    expect(error.message).toMatch(/not host/i)
    socket.disconnect()
  })

  it('sets turnOrder excluding spectators', async () => {
    await Room.create({
      code: 'STR004', status: 'writing', hostSessionToken: 'host-token',
      players: [
        { sessionToken: 'host-token', socketId: 'x', name: 'Host', submittedQuestions: false, isSpectator: false },
        { sessionToken: 'spec-token', socketId: 'y', name: 'Spec', submittedQuestions: false, isSpectator: true },
      ],
      questions: [{ text: 'Q1', type: 'fun', used: false, authorSessionToken: 'host-token' }],
      turnOrder: [], currentTurnIndex: 0,
    })
    const socket = await connect()
    await joinRoom(socket, 'STR004', 'Host', 'host-token')

    const updated = await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('room:start', { code: 'STR004', sessionToken: 'host-token' })
    })
    expect(updated.room.turnOrder).toContain('host-token')
    expect(updated.room.turnOrder).not.toContain('spec-token')
    socket.disconnect()
  })
})
```

### Helper function (add to top of test file)

```js
// Reusable join helper to avoid repeating the await pattern
function joinRoom(socket, code, playerName, sessionToken) {
  return new Promise(resolve => {
    socket.once('room:updated', resolve)
    socket.emit('room:join', { code, playerName, sessionToken })
  })
}
```

---

## Checklist — do in this exact order

- [ ] Add test cases above to `gameHandlers.test.js`
- [ ] Run `vitest run` → confirm all new tests are **RED**
- [ ] Implement `room:writing` handler → run tests → `room:writing` block **GREEN**
- [ ] Implement `question:submit` handler → run tests → `question:submit` block **GREEN**
- [ ] Implement `room:start` handler → run tests → `room:start` block **GREEN**
- [ ] All tests GREEN → commit server work
- [ ] Add `startWriting`, `submitQuestions`, `startPlaying` to `GameContext.jsx`
- [ ] Update `Lobby.jsx` — "Start Writing" button + redirect on `status === 'writing'`
- [ ] Build `WriteQuestions.jsx` — form + "Waiting..." state + "Start Playing" button (host only) + redirect on `status === 'playing'`
- [ ] Manual verify (see below)

---

## Manual verification

1. Open two browser windows (one normal, one incognito) — both join the same room
2. Window 1 is host → click **"Start Writing"** → both windows navigate to `/writing`
3. Window 2 submits questions → Window 1 sees the checkmark update in player list
4. Window 1 clicks **"Start Playing"** without submitting → should succeed (pool not empty)
5. Both windows navigate to `/playing`
6. Repeat steps 1–3 but have Window 1 click "Start Playing" before anyone submits → should show error "no questions"

---

## What this phase does NOT do

- Does not implement the playing phase UI (that is Phase 5)
- Does not auto-advance when all players submit — advancing is always host-controlled
- Does not add client-side tests for Context functions — socket behavior is covered by server tests
