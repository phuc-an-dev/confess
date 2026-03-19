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
