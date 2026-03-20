import { useEffect, useState, useRef } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { Navigate } from 'react-router-dom'
import { socket } from '../lib/socket.js'

const TYPE_STYLES = {
  serious: 'bg-yellow-300 border-black text-black',
  fun:     'bg-pink-300 border-black text-black',
  normal:  'bg-blue-300 border-black text-black',
}

export default function Playing() {
  const { room, sessionToken } = useGame()
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [currentPlayerName, setCurrentPlayerName] = useState('')
  const [activeMeme, setActiveMeme] = useState(null)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const lastMemeTime = useRef(0)
  const memeTimer = useRef(null)

  useEffect(() => {
    const onQuestion = ({ question, currentPlayerName }) => {
      setCurrentQuestion(question)
      setCurrentPlayerName(currentPlayerName)
    }

    const onMeme = ({ memeId, senderName }) => {
      setActiveMeme({ memeId, senderName })
      if (memeTimer.current) clearTimeout(memeTimer.current)
      memeTimer.current = setTimeout(() => setActiveMeme(null), 3000)
    }

    const onQuestionsEmpty = () => {
      setShowEndConfirm(true)
    }

    socket.on('question:random', onQuestion)
    socket.on('meme:broadcast', onMeme)
    socket.on('questions:empty', onQuestionsEmpty)

    return () => {
      socket.off('question:random', onQuestion)
      socket.off('meme:broadcast', onMeme)
      socket.off('questions:empty', onQuestionsEmpty)
      if (memeTimer.current) clearTimeout(memeTimer.current)
    }
  }, [])

  if (!room) return null
  if (room.status === 'writing') return <Navigate to="/writing" />

  const isHost = room.hostSessionToken === sessionToken

  const handleNext = () => {
    socket.emit('round:next', { code: room.code, sessionToken })
  }

  const handleConfirmEnd = () => {
    setShowEndConfirm(false)
    socket.emit('round:confirm-end', { code: room.code, sessionToken })
  }

  const sendMeme = (memeId) => {
    const now = Date.now()
    if (now - lastMemeTime.current < 300) return
    lastMemeTime.current = now
    socket.emit('meme:send', { code: room.code, sessionToken, memeId })
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white text-black font-sans p-4 flex flex-col items-center">

      {/* ── Question card ── */}
      {currentQuestion ? (
        <div className="w-full max-w-2xl border-8 border-black bg-white shadow-[16px_16px_0_0_#000] z-10 mb-8 mt-10 transition-all relative">

          {/* Type label — top-left corner */}
          <span className={`absolute top-0 left-0 border-r-4 border-b-4 border-black px-4 py-1 font-black uppercase tracking-widest text-sm ${TYPE_STYLES[currentQuestion.type] ?? 'bg-gray-200'}`}>
            {currentQuestion.type}
          </span>

          <div className="p-8 md:p-12 pt-12 text-center">
            {/* Player name — big & bold, most prominent element */}
            <div className="mb-6 flex items-center justify-center gap-4 flex-wrap">
              <span className="inline-block bg-black text-white font-black text-2xl md:text-4xl uppercase tracking-widest px-6 py-3 shadow-[6px_6px_0_0_#555]">
                {currentPlayerName}
              </span>
              <span className="font-black text-xl md:text-3xl uppercase tracking-[0.2em] text-gray-500">IS ANSWERING</span>
            </div>

            {/* Question text */}
            <p className="text-2xl md:text-5xl font-black uppercase leading-tight">
              "{currentQuestion.text}"
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-2xl border-8 border-black p-12 text-center z-10 font-black text-2xl uppercase mt-10 shadow-[12px_12px_0_0_#000]">
          Waiting for host to draw a question...
        </div>
      )}

      {/* ── Host: Next button ── */}
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

      {/* ── React panel (30 slots) ── */}
      <div className="z-20 w-full max-w-2xl mt-auto pt-8 border-t-8 border-black">
        <h3 className="font-black text-2xl mb-4 uppercase inline-block border-b-4 border-black">React</h3>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 30 }).map((_, i) => (
            <button
              key={i}
              onClick={() => sendMeme(`meme-${String(i + 1).padStart(2, '0')}`)}
              className="aspect-square border-4 border-black bg-gray-100 hover:bg-gray-200 transition-colors p-0 overflow-hidden flex items-center justify-center relative group"
            >
              <img
                src={`/memes/meme-${String(i + 1).padStart(2, '0')}.png`}
                alt={`Meme ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <span className="absolute inset-0 bg-black/50 text-white font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs">SEND</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Meme overlay ── */}
      {activeMeme && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div key={activeMeme.memeId + Date.now()} className="animate-popin flex flex-col items-center">
            <div className="border-8 border-black bg-white shadow-[16px_16px_0_0_#000] overflow-hidden" style={{ width: 'min(80vw, 80vh)', height: 'min(80vw, 80vh)' }}>
              <img
                src={`/memes/${activeMeme.memeId}.png`}
                alt="Meme"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
            <div className="bg-black text-white font-black text-2xl md:text-4xl uppercase px-8 py-3 border-8 border-t-0 border-black shadow-[8px_8px_0_0_#555]">
              {activeMeme.senderName}
            </div>
          </div>
        </div>
      )}

      {/* ── Host modal: questions empty confirm ── */}
      {showEndConfirm && isHost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="bg-white border-8 border-black shadow-[16px_16px_0_0_#000] p-10 max-w-md w-full text-center">
            <h2 className="text-3xl font-black uppercase mb-2">Out of Questions</h2>
            <p className="text-lg font-bold mb-8 text-gray-600">
              All questions have been used. Confirm to go back to the writing phase.
            </p>
            <button
              onClick={handleConfirmEnd}
              className="w-full bg-black text-white font-black text-xl p-5 uppercase tracking-widest border-4 border-black hover:bg-white hover:text-black transition-colors"
            >
              Confirm &amp; Write New Questions
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
