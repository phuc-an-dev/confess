import { createContext, useContext, useState, useEffect } from 'react'
import { socket } from '../lib/socket.js'
import { getSessionToken } from '../lib/session.js'

const GameContext = createContext()

export function GameProvider({ children }) {
  const [room, setRoom] = useState(null)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    socket.on('room:updated', ({ room }) => setRoom(room))
    socket.on('error', ({ message }) => setError(message))
    
    return () => {
      socket.off('room:updated')
      socket.off('error')
    }
  }, [])
  
  const joinRoom = (code, playerName) => {
    setError(null)
    socket.emit('room:join', { 
      code: code.toUpperCase(), 
      playerName, 
      sessionToken: getSessionToken() 
    })
  }

  const startWriting = () => {
    setError(null)
    socket.emit('room:writing', { code: room?.code, sessionToken: getSessionToken() })
  }

  const submitQuestions = (questions) => {
    setError(null)
    socket.emit('question:submit', { code: room?.code, sessionToken: getSessionToken(), questions })
  }

  const startPlaying = () => {
    setError(null)
    socket.emit('room:start', { code: room?.code, sessionToken: getSessionToken() })
  }

  return (
    <GameContext.Provider value={{ room, error, joinRoom, startWriting, submitQuestions, startPlaying, sessionToken: getSessionToken() }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => useContext(GameContext)
