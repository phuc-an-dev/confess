import Room from '../models/Room.js'
import { pickRandomQuestion, advanceTurn } from '../lib/gameLogic.js'

export function setupGameHandlers(io, socket) {
  socket.on('room:writing', async (payload) => {
    const { code, sessionToken } = payload
    const room = await Room.findOne({ code })
    if (!room) return

    if (room.hostSessionToken !== sessionToken) {
      socket.emit('error', { message: 'not host' })
      return
    }
    if (room.status !== 'lobby') {
      socket.emit('error', { message: 'invalid status' })
      return
    }

    room.status = 'writing'
    await room.save()
    io.to(code).emit('room:updated', { room })
  })

  socket.on('question:submit', async (payload) => {
    const { code, sessionToken, questions } = payload
    const room = await Room.findOne({ code })
    if (!room) return

    const player = room.players.find(p => p.sessionToken === sessionToken)
    if (!player || player.isSpectator) return

    for (const q of questions) {
      room.questions.push({
        authorSessionToken: sessionToken,
        text: q.text,
        type: q.type || 'normal',
        used: false
      })
    }
    
    player.submittedQuestions = true
    await room.save()
    io.to(code).emit('room:updated', { room })
  })

  socket.on('room:start', async (payload) => {
    const { code, sessionToken } = payload
    const room = await Room.findOne({ code })
    if (!room) return

    if (room.hostSessionToken !== sessionToken) {
      socket.emit('error', { message: 'not host' })
      return
    }
    if (room.status !== 'writing') {
      socket.emit('error', { message: 'invalid status' })
      return
    }

    if (!room.questions.some(q => !q.used)) {
      socket.emit('error', { message: 'no questions' })
      return
    }

    const activePlayers = room.players.filter(p => !p.isSpectator).map(p => p.sessionToken)
    // simple shuffle
    room.turnOrder = activePlayers.sort(() => Math.random() - 0.5)

    room.status = 'playing'
    await room.save()
    io.to(code).emit('room:updated', { room })
  })

  socket.on('round:next', async (payload) => {
    const { code, sessionToken } = payload
    const room = await Room.findOne({ code })
    if (!room) return

    if (room.hostSessionToken !== sessionToken) return

    const q = pickRandomQuestion(room.questions)
    if (!q) {
      // Notify host only — wait for confirmation before going back to writing
      socket.emit('questions:empty')
      return
    }

    q.used = true
    room.currentTurnIndex = advanceTurn(room.currentTurnIndex)
    
    let currentPlayerName = 'Unknown'
    if (room.turnOrder && room.turnOrder.length > 0) {
      const playerToken = room.turnOrder[room.currentTurnIndex % room.turnOrder.length]
      const currentPlayer = room.players.find(p => p.sessionToken === playerToken)
      if (currentPlayer) currentPlayerName = currentPlayer.name
    }
    
    await room.save()
    io.to(code).emit('question:random', { question: q, currentPlayerName })
  })

  // Host confirmed they want to go back to writing phase
  socket.on('round:confirm-end', async (payload) => {
    const { code, sessionToken } = payload
    const room = await Room.findOne({ code })
    if (!room) return
    if (room.hostSessionToken !== sessionToken) return

    room.status = 'writing'
    room.players.forEach(p => p.submittedQuestions = false)
    await room.save()
    io.to(code).emit('room:updated', { room })
  })

  socket.on('meme:send', async (payload) => {
    const { code, sessionToken, memeId } = payload
    const room = await Room.findOne({ code })
    if (!room) return

    const sender = room.players.find(p => p.sessionToken === sessionToken)
    if (!sender) return

    io.to(code).emit('meme:broadcast', { memeId, senderName: sender.name })
  })
}
