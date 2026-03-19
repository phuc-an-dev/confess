import Room from '../models/Room.js'

export function setupRoomHandlers(io, socket) {
  socket.on('room:join', async (payload) => {
    const { code, playerName, sessionToken } = payload
    
    const room = await Room.findOne({ code })
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    socket.join(code)

    let player = room.players.find(p => p.sessionToken === sessionToken)

    if (player) {
      player.socketId = socket.id
      player.name = playerName
    } else {
      const isSpectator = room.status === 'playing'
      player = {
        sessionToken,
        socketId: socket.id,
        name: playerName,
        submittedQuestions: false,
        isSpectator
      }
      room.players.push(player)
      
      if (!room.hostSessionToken) {
        room.hostSessionToken = sessionToken
      }
      
      if (!isSpectator) {
        room.turnOrder.push(sessionToken)
      }
    }

    socket.data.roomCode = code
    socket.data.sessionToken = sessionToken

    await room.save()
    io.to(code).emit('room:updated', { room })
  })
  
  socket.on('disconnect', async () => {
    const { roomCode, sessionToken } = socket.data
    if (!roomCode || !sessionToken) return
    
    const room = await Room.findOne({ code: roomCode })
    if (!room) return
    
    if (room.hostSessionToken === sessionToken) {
      const nextPlayer = room.players.find(p => p.sessionToken !== sessionToken)
      if (nextPlayer) {
        room.hostSessionToken = nextPlayer.sessionToken
        await room.save()
        io.to(roomCode).emit('room:updated', { room })
      }
    }
  })
}
