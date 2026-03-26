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
    
    // Auto-rejoin on F5 / mount if we have a saved code
    const savedCode = localStorage.getItem('roomCode')
    if (savedCode) {
      socket.emit('room:join', { 
        code: savedCode, 
        sessionToken: getSessionToken() 
      })
    }

    return () => {
      socket.off('room:updated')
      socket.off('error')
    }
  }, [])
  
  const joinRoom = (code, playerName) => {
    setError(null)
    localStorage.setItem('roomCode', code.toUpperCase())
    if (playerName) localStorage.setItem('playerName', playerName)
    socket.emit('room:join', { 
      code: code.toUpperCase(), 
      playerName, 
      sessionToken: getSessionToken() 
    })
  }

  const leaveRoom = () => {
    localStorage.removeItem('roomCode')
    setRoom(null)
    // could also emit leave but basic state clear is enough for F5 resilience
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
    <GameContext.Provider value={{ room, error, joinRoom, leaveRoom, startWriting, submitQuestions, startPlaying, sessionToken: getSessionToken() }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => useContext(GameContext)
