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

describe('question:rate', () => {
  it('allows a user to spam clicks but only saves 1 vote per category in DB', async () => {
    const questionId = '507f1f77bcf86cd799439011'
    const room = await Room.create({
      code: 'RATING', status: 'playing', hostSessionToken: 'host',
      players: [
        { sessionToken: 'user1', socketId: 's1', name: 'User 1', isSpectator: false }
      ],
      questions: [
        { _id: questionId, text: 'Q1', type: 'normal', used: true, ratings: [] }
      ],
      currentTurnIndex: 0
    })

    const socket = await connect()
    
    // Have user join
    await new Promise(resolve => {
      socket.on('room:updated', resolve)
      socket.emit('room:join', { code: 'RATING', playerName: 'User 1', sessionToken: 'user1' })
    })

    // Suppose user clicks "deep" 3 times very fast
    socket.emit('question:rate', { code: 'RATING', sessionToken: 'user1', questionId: questionId, type: 'deep' })
    socket.emit('question:rate', { code: 'RATING', sessionToken: 'user1', questionId: questionId, type: 'deep' })
    socket.emit('question:rate', { code: 'RATING', sessionToken: 'user1', questionId: questionId, type: 'deep' })

    // Wait a bit more for DB updates to settle
    await new Promise(r => setTimeout(r, 500))

    const updatedRoom = await Room.findOne({ code: 'RATING' })
    const qRatings = updatedRoom.questions[0].ratings || []
    
    // DB should only have 1 vote for "deep" from "user1"
    const deepVotes = qRatings.filter(r => r.type === 'deep' && r.playerSessionToken === 'user1')
    expect(deepVotes.length).toBe(1)
    
    socket.disconnect()
  })
})
