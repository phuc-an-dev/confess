import Room from '../models/Room.js'
import QuestionBank from '../models/QuestionBank.js'
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

    // Only mix in system questions from QuestionBank if NO user submitted questions exist
    if (room.questions.length === 0) {
      const needed = 10
      const systemQs = await QuestionBank.aggregate([
        { $sample: { size: needed } }
      ])
      
      for (const sq of systemQs) {
        room.questions.push({
          questionBankId: sq._id,
          text: sq.text,
          type: sq.type,
          used: false
        })
      }
    }

    if (!room.questions.some(q => !q.used)) {
      socket.emit('error', { message: 'no questions' })
      return
    }

    const activePlayers = room.players.filter(p => !p.isSpectator).map(p => p.sessionToken)
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
      socket.emit('questions:empty')
      return
    }

    q.used = true
    
    // If user written, save to global QuestionBank
    if (!q.questionBankId && q.authorSessionToken) {
      const author = room.players.find(p => p.sessionToken === q.authorSessionToken)
      try {
        // Prevent duplicates for the SAME user (check text + same authorSessionToken)
        const exists = await QuestionBank.findOne({ 
          text: q.text, 
          authorSessionToken: q.authorSessionToken 
        })
        
        if (!exists) {
          const newDbQ = await QuestionBank.create({
            text: q.text,
            type: q.type,
            isUserSubmitted: true,
            authorIp: author?.ipAddress || null,
            authorName: author?.name || null,
            authorSessionToken: q.authorSessionToken
          })
          q.questionBankId = newDbQ._id
        } else {
          q.questionBankId = exists._id
        }
      } catch(e) {
        console.error('Error saving to bank:', e)
      }
    }

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

  socket.on('question:rate', async (payload) => {
    const { code, sessionToken, questionId, type } = payload
    const room = await Room.findOne({ code })
    if (!room) return

    const question = room.questions.id(questionId)
    if (!question) return

    // Only save +1 to DB per category per user to prevent infinite spam
    // Use atomic updateOne to avoid Mongoose VersionError from concurrent saves
    const result = await Room.updateOne(
      { 
        code, 
        "questions._id": questionId,
        // Ensure there is NO existing rating for this player AND type
        $nor: [
          { "questions": { $elemMatch: { _id: questionId, "ratings": { $elemMatch: { playerSessionToken: sessionToken, type } } } } }
        ]
      },
      {
        $push: { "questions.$[q].ratings": { playerSessionToken: sessionToken, type } }
      },
      { arrayFilters: [{ "q._id": questionId }] }
    )

    // If the vote was successfully recorded uniquely in the Room
    if (result.modifiedCount > 0) {
      // Broadcast the NEW total to everyone (prevents visual spam since it's a stable number)
      const updatedRoom = await Room.findOne({ code })
      const updatedQ = updatedRoom.questions.id(questionId)
      const newCount = updatedQ.ratings.filter(r => r.type === type).length
      
      io.to(code).emit('question:rated', { questionId, type, total: newCount })

      if (question.questionBankId) {
        await QuestionBank.updateOne(
          { _id: question.questionBankId },
          { $inc: { [`stats.${type}`]: 1 } }
        )
      }
    }
  })

  socket.on('question:unrate', async (payload) => {
    const { code, sessionToken, questionId, type } = payload
    const room = await Room.findOne({ code })
    if (!room) return

    const question = room.questions.id(questionId)
    if (!question) return

    // Find ratings to remove (either all or specific type)
    const playerRatings = question.ratings.filter(r => 
      r.playerSessionToken === sessionToken && (!type || r.type === type)
    )
    if (playerRatings.length === 0) return

    // Prepare decrement object for QuestionBank
    const decStats = {}
    playerRatings.forEach(r => {
      decStats[`stats.${r.type}`] = -1
    })

    // Update Room: remove the ratings
    const pullQuery = { playerSessionToken: sessionToken }
    if (type) pullQuery.type = type

    await Room.updateOne(
      { code, "questions._id": questionId },
      { $pull: { "questions.$[q].ratings": pullQuery } },
      { arrayFilters: [{ "q._id": questionId }] }
    )

    // Update QuestionBank: decrement stats if it was a global question
    if (question.questionBankId) {
      await QuestionBank.updateOne(
        { _id: question.questionBankId },
        { $inc: decStats }
      )
    }

    // Inform clients about the new totals
    const updatedRoom = await Room.findOne({ code })
    const updatedQ = updatedRoom.questions.id(questionId)
    
    // Broadcast totals for all types that were changed
    const typesToUpdate = type ? [type] : ['deep', 'funny', 'good', 'bad']
    typesToUpdate.forEach(t => {
      const newCount = updatedQ.ratings.filter(r => r.type === t).length
      io.to(code).emit('question:rated', { questionId, type: t, total: newCount })
    })

    // Still send room:updated for other state synchronizations
    io.to(code).emit('room:updated', { room: updatedRoom })
  })
}
