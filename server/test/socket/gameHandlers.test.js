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


// Reusable join helper to avoid repeating the await pattern
function joinRoom(socket, code, playerName, sessionToken) {
  return new Promise(resolve => {
    socket.once('room:updated', resolve)
    socket.emit('room:join', { code, playerName, sessionToken })
  })
}

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

  it('emits room:updated transitioning back to writing when pool is exhausted', async () => {
    await Room.create({
      code: 'DONE01', status: 'playing', hostSessionToken: 'seed',
      players: [{ sessionToken: 'seed', socketId: 'x', name: 'Host', submittedQuestions: true, isSpectator: false }],
      questions: [{ text: 'Q1', type: 'fun', used: true, authorSessionToken: 'seed' }],
      turnOrder: ['seed'], currentTurnIndex: 0,
    })
    const socket = await connect()
    await new Promise(resolve => { socket.on('room:updated', resolve); socket.emit('room:join', { code: 'DONE01', playerName: 'Host', sessionToken: 'seed' }) })
    const event = await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('round:next', { code: 'DONE01', sessionToken: 'seed' })
    })
    expect(event.room.status).toBe('writing')
    expect(event.room.players[0].submittedQuestions).toBe(false)
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
