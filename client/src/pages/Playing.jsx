import { useEffect, useState, useRef, useMemo } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { Navigate } from 'react-router-dom'
import { socket } from '../lib/socket.js'
import { Heart, Smile, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react'
import Button from '../components/Button'

export default function Playing() {
  const { room, sessionToken } = useGame()
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [currentPlayerName, setCurrentPlayerName] = useState('')
  const [activeMeme, setActiveMeme] = useState(null)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  
  const [isNextLoading, setIsNextLoading] = useState(false)
  const [isFinishLoading, setIsFinishLoading] = useState(false)

  // Real-time ratings count
  const [ratingsCount, setRatingsCount] = useState({ deep: 0, funny: 0, good: 0, bad: 0 })
  const [myRatings, setMyRatings] = useState({ deep: 0, funny: 0, good: 0, bad: 0 })

  const lastMemeTime = useRef(0)
  const memeTimer = useRef(null)

  // Randomize memes every time question changes
  const [shuffledMemes, setShuffledMemes] = useState([])

  useEffect(() => {
    const onQuestion = ({ question, currentPlayerName }) => {
      setCurrentQuestion(question)
      setCurrentPlayerName(currentPlayerName)
      
      // Initialize counts from question data
      const initialCounts = { deep: 0, funny: 0, good: 0, bad: 0 }
      const initialMyRatings = { deep: 0, funny: 0, good: 0, bad: 0 }
      
      if (question.ratings) {
        question.ratings.forEach(r => {
          if (initialCounts.hasOwnProperty(r.type)) {
            initialCounts[r.type]++
          }
          if (r.playerSessionToken === sessionToken) {
            initialMyRatings[r.type] = 1
          }
        })
      }
      
      setRatingsCount(initialCounts)
      setMyRatings(initialMyRatings)
      setIsNextLoading(false)
      
      // Reshuffle memes
      setShuffledMemes(Array.from({ length: 87 }, (_, i) => String(i + 1).padStart(2, '0')).sort(() => Math.random() - 0.5))
    }

    const onMeme = ({ memeId, senderName }) => {
      setActiveMeme({ memeId, senderName })
      if (memeTimer.current) clearTimeout(memeTimer.current)
      memeTimer.current = setTimeout(() => setActiveMeme(null), 3000)
    }

    const onQuestionsEmpty = () => {
      setShowEndConfirm(true)
      setIsNextLoading(false)
    }

    const onRated = ({ type, total }) => {
      setRatingsCount(prev => ({ ...prev, [type]: total }))
    }

    socket.on('question:random', onQuestion)
    socket.on('meme:broadcast', onMeme)
    socket.on('questions:empty', onQuestionsEmpty)
    socket.on('question:rated', onRated)

    return () => {
      socket.off('question:random', onQuestion)
      socket.off('meme:broadcast', onMeme)
      socket.off('questions:empty', onQuestionsEmpty)
      socket.off('question:rated', onRated)
      if (memeTimer.current) clearTimeout(memeTimer.current)
    }
  }, [])

  if (!room) return null
  if (room.status === 'writing') return <Navigate to="/writing" />

  const isHost = room.hostSessionToken === sessionToken

  const handleNext = () => {
    setIsNextLoading(true)
    socket.emit('round:next', { code: room.code, sessionToken })
    setTimeout(() => setIsNextLoading(false), 5000)
  }

  const handleConfirmEnd = () => {
    setIsFinishLoading(true)
    socket.emit('round:confirm-end', { code: room.code, sessionToken })
  }

  const sendMeme = (memeId) => {
    const now = Date.now()
    if (now - lastMemeTime.current < 300) return
    lastMemeTime.current = now
    socket.emit('meme:send', { code: room.code, sessionToken, memeId })
  }

  const handleToggleRate = (type) => {
    if (!currentQuestion) return
    const isRated = myRatings[type] === 1
    
    if (isRated) {
      socket.emit('question:unrate', { code: room.code, sessionToken, questionId: currentQuestion._id, type })
      setMyRatings(prev => ({ ...prev, [type]: 0 }))
    } else {
      socket.emit('question:rate', { code: room.code, sessionToken, questionId: currentQuestion._id, type })
      setMyRatings(prev => ({ ...prev, [type]: 1 }))
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white text-black font-sans p-4 flex flex-col items-center">

      {/* ── Question card ── */}
      {currentQuestion ? (
        <div className="w-full max-w-2xl border-4 border-black bg-white shadow-[4px_4px_0_0_#000] z-10 mb-8 mt-10 transition-all relative">

          {/* Type label */}
          <span className="absolute top-0 left-0 border-r-4 border-b-4 border-black px-4 py-1 font-black uppercase tracking-widest text-[10px] bg-black text-white">
            {currentQuestion.type}
          </span>
          
          {/* User Submitted Badge */}
          {currentQuestion.authorSessionToken && (
            <span className="absolute top-0 right-0 border-l-4 border-b-4 border-black px-4 py-1 font-black uppercase tracking-widest text-[10px] bg-white text-black">
              Player Created
            </span>
          )}

          <div className="p-4 md:p-12 pt-14 pb-6 text-center">
            {/* Player name */}
            <div className="mb-6 flex items-center justify-center gap-4 flex-wrap mt-4">
              <span className="inline-block bg-black text-white font-black text-2xl md:text-3xl uppercase tracking-widest px-6 py-3 shadow-[4px_4px_0_0_#ccc]">
                {currentPlayerName}
              </span>
              <span className="font-black text-lg md:text-xl uppercase tracking-[0.2em] text-gray-400">IS ANSWERING</span>
            </div>

            {/* Question text */}
            <p className="text-xl md:text-4xl font-black uppercase leading-tight mb-8">
              "{currentQuestion.text}"
            </p>
            {/* Rating Area */}
            <div className="mt-8 pt-6 border-t-4 border-dashed border-black/10 grid grid-cols-4 gap-4 relative">
              <button 
                onClick={() => handleToggleRate('deep')} 
                className={`flex  gap-2 items-center justify-center p-3 border-4 border-black shadow-[4px_4px_0_0_#000] transition-all active:translate-y-0.5 bg-white relative `}
              >
                <Heart size={28} />
                <span className="font-black text-xl leading-none">{ratingsCount.deep}</span>
              </button>
              
              <button 
                onClick={() => handleToggleRate('funny')} 
                className={`flex  gap-2 items-center justify-center p-3 border-4 border-black shadow-[4px_4px_0_0_#000] transition-all active:translate-y-0.5 bg-white `}
              >
                <Smile size={28} />
                <span className="font-black text-xl leading-none">{ratingsCount.funny}</span>
              </button>
              
              <button 
                onClick={() => handleToggleRate('good')} 
                className={`flex  gap-2 items-center justify-center p-3 border-4 border-black shadow-[4px_4px_0_0_#000] transition-all active:translate-y-0.5 bg-white `}
              >
                <ThumbsUp size={28} />
                <span className="font-black text-xl leading-none">{ratingsCount.good}</span>
              </button>
              
              <button 
                onClick={() => handleToggleRate('bad')} 
                className={`flex  gap-2 items-center justify-center p-3 border-4 border-black shadow-[4px_4px_0_0_#000] transition-all active:translate-y-0.5 bg-white `}
              >
                <ThumbsDown size={28} />
                <span className="font-black text-xl leading-none">{ratingsCount.bad}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-2xl border-4 border-black p-12 text-center z-10 font-black text-xl uppercase mt-10 shadow-[4px_4px_0_0_#ccc] animate-pulse bg-white">
          Waiting for host to draw a question...
        </div>
      )}

      {/* ── Host: Next button ── */}
      {isHost && (
        <div className="z-20 w-full max-w-2xl mt-4">
          <Button
            onClick={handleNext}
            isLoading={isNextLoading}
            className="w-full p-6 text-xl tracking-[0.2em]"
          >
            NEXT QUESTION
          </Button>
        </div>
      )}

      {/* ── React panel ── */}
      <div className="z-20 w-full max-w-2xl mt-auto pt-8 border-t-8 border-black">
        <h3 className="font-black text-2xl uppercase border-b-4 border-black pb-2 mb-4">React Gallery</h3>
        <div className="grid grid-cols-5 md:grid-cols-6 gap-2">
          {shuffledMemes.map((memeId, i) => (
            <button
              key={memeId + '-' + i}
              onClick={() => sendMeme(`meme-${memeId}`)}
              className="aspect-square border-4 border-black bg-white hover:bg-gray-100 transition-all p-0 overflow-hidden flex items-center justify-center active:translate-y-0.5"
            >
              <img
                src={`/memes/meme-${memeId}.png`}
                alt={`Meme ${memeId}`}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* ── Meme overlay ── */}
      {activeMeme && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div key={activeMeme.memeId + Date.now()} className="animate-popin flex flex-col items-center">
            <div className="border-4 border-black bg-white shadow-[12px_12px_0_0_#000] overflow-hidden" style={{ width: 'min(70vw, 70vh)', height: 'min(70vw, 70vh)' }}>
              <img
                src={`/memes/${activeMeme.memeId}.png`}
                alt="Meme"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
            <div className="bg-black text-white font-black text-xl md:text-3xl uppercase px-8 py-3 border-4 border-t-0 border-black shadow-[6px_6px_0_0_#555]">
              {activeMeme.senderName}
            </div>
          </div>
        </div>
      )}

      {/* ── Host modal: out of questions ── */}
      {showEndConfirm && isHost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-10 max-w-md w-full text-center">
            <h2 className="text-3xl font-black uppercase mb-2">Out of Questions</h2>
            <p className="text-lg font-bold mb-8 text-gray-500 uppercase tracking-tight leading-tight">
              All questions have been used. Confirm to go back to the writing phase.
            </p>
            <Button
              onClick={handleConfirmEnd}
              isLoading={isFinishLoading}
              className="w-full p-5"
            >
              Confirm & Write New
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
