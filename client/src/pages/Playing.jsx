import { useEffect, useState, useRef } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { Navigate } from 'react-router-dom'
// Import socket STATICALLY so useEffect cleanup works correctly.
// Using dynamic import inside useEffect means the cleanup function returned
// from the .then() is never seen by React → listeners stack up → meme fires twice.
import { socket } from '../lib/socket.js'

export default function Playing() {
  const { room, sessionToken } = useGame()
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [currentPlayerName, setCurrentPlayerName] = useState('')
  const [activeMeme, setActiveMeme] = useState(null)
  // All hooks ABOVE every early return
  const lastMemeTime = useRef(0)
  const memeTimer = useRef(null)

  useEffect(() => {
    const onQuestion = ({ question, currentPlayerName }) => {
      setCurrentQuestion(question)
      setCurrentPlayerName(currentPlayerName)
    }

    const onMeme = ({ memeId, senderName }) => {
      setActiveMeme({ memeId, senderName })
      // Clear any existing timer so spamming replaces the current meme
      if (memeTimer.current) clearTimeout(memeTimer.current)
      memeTimer.current = setTimeout(() => setActiveMeme(null), 3000)
    }

    socket.on('question:random', onQuestion)
    socket.on('meme:broadcast', onMeme)

    // Properly registered cleanup — React WILL call this on unmount
    return () => {
      socket.off('question:random', onQuestion)
      socket.off('meme:broadcast', onMeme)
      if (memeTimer.current) clearTimeout(memeTimer.current)
    }
  }, [])

  // Early returns AFTER all hooks
  if (!room) return null
  if (room.status === 'writing') return <Navigate to="/writing" />

  const isHost = room.hostSessionToken === sessionToken

  const handleNext = () => {
    socket.emit('round:next', { code: room.code, sessionToken })
  }

  const sendMeme = (memeId) => {
    const now = Date.now()
    if (now - lastMemeTime.current < 300) return
    lastMemeTime.current = now
    socket.emit('meme:send', { code: room.code, sessionToken, memeId })
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white text-black font-sans p-4 flex flex-col items-center">
      {currentQuestion ? (
        <div className="w-full max-w-2xl border-8 border-black p-8 md:p-12 text-center bg-white shadow-[16px_16px_0_0_#000] z-10 mb-8 mt-10 transition-all">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] mb-8 border-b-4 border-black pb-2 inline-block shadow-[4px_4px_0_0_#000]">
            {currentPlayerName} IS ANSWERING
          </h2>
          <p className="text-3xl md:text-6xl font-black uppercase leading-tight mb-8">
            "{currentQuestion.text}"
          </p>
          <span className="inline-block border-4 border-black px-6 py-2 font-black uppercase tracking-widest text-sm md:text-base bg-black text-white">
            {currentQuestion.type}
          </span>
        </div>
      ) : (
        <div className="w-full max-w-2xl border-8 border-black p-12 text-center z-10 font-black text-2xl uppercase mt-10 shadow-[12px_12px_0_0_#000]">
          Waiting for host to draw a question...
        </div>
      )}

      {isHost && (
        <div className="z-20 w-full max-w-2xl mt-4">
          <button
            onClick={handleNext}
            className="w-full bg-black text-white p-6 font-black text-2xl tracking-[0.2em] uppercase border-4 border-black hover:bg-white hover:text-black shadow-[8px_8px_0_0_#000] hover:shadow-none transition-all"
          >
            NEXT QUESTION
          </button>
        </div>
      )}

      <div className="z-20 w-full max-w-2xl mt-auto pt-8 border-t-8 border-black">
        <h3 className="font-black text-2xl mb-4 uppercase inline-block border-b-4 border-black">React</h3>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <button
              key={i}
              onClick={() => sendMeme(`meme-${String(i+1).padStart(2,'0')}`)}
              className="aspect-square border-4 border-black bg-gray-100 hover:bg-gray-200 transition-colors p-0 overflow-hidden flex items-center justify-center relative group"
            >
              <img
                src={`/memes/meme-${String(i+1).padStart(2,'0')}.png`}
                alt={`Meme ${i+1}`}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display='none' }}
              />
              <span className="absolute inset-0 bg-black/50 text-white font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs">SEND</span>
            </button>
          ))}
        </div>
      </div>

      {/* Single large centered meme — replaces itself on spam */}
      {activeMeme && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div key={activeMeme.memeId + Date.now()} className="animate-popin flex flex-col items-center">
            <div className="border-8 border-black bg-white shadow-[16px_16px_0_0_#000] overflow-hidden" style={{ width: 'min(80vw, 80vh)', height: 'min(80vw, 80vh)' }}>
              <img
                src={`/memes/${activeMeme.memeId}.png`}
                alt="Meme"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display='none' }}
              />
            </div>
            <div className="bg-black text-white font-black text-2xl md:text-4xl uppercase px-8 py-3 border-8 border-t-0 border-black shadow-[8px_8px_0_0_#555]">
              {activeMeme.senderName}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
