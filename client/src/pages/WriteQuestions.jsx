import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { Navigate } from 'react-router-dom'
import { CheckCircle2, Hourglass, Dices, History, X, ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../components/Button'

export default function WriteQuestions() {
  const { room, sessionToken, submitQuestions, startPlaying, error } = useGame()
  
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')

  const [isSubmitLoading, setIsSubmitLoading] = useState(false)
  const [isStartLoading, setIsStartLoading] = useState(false)
  const [randomLoading, setRandomLoading] = useState({ q1: false, q2: false, q3: false })

  // History states
  const [showHistory, setShowHistory] = useState(false)
  const [historyType, setHistoryType] = useState('normal')
  const [historySetter, setHistorySetter] = useState(null)
  const [historyData, setHistoryData] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  if (error) return <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center"><div className="border-4 border-red-500 p-4 text-red-500 font-bold mb-4 bg-red-50">Error: {error}</div><a href="/" className="font-bold underline decoration-4 hover:bg-black hover:text-white p-2 transition-all">Go Back</a></div>
  if (!room) return <div className="min-h-screen flex items-center justify-center p-4 font-bold animate-pulse text-2xl">Loading...</div>
  
  if (room.status === 'lobby') return <Navigate to="/lobby" />
  if (room.status === 'playing') return <Navigate to="/playing" />

  const isHost = room.hostSessionToken === sessionToken
  const me = room.players.find(p => p.sessionToken === sessionToken)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!q1.trim() || !q2.trim() || !q3.trim()) return
    setIsSubmitLoading(true)
    submitQuestions([
      { text: q1, type: 'serious' },
      { text: q2, type: 'fun' },
      { text: q3, type: 'normal' }
    ])
  }

  const handleRandom = async (type, setter, key) => {
    setRandomLoading(prev => ({ ...prev, [key]: true }))
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/rooms/random-question?type=${type}`)
      if (res.ok) {
        const data = await res.json()
        setter(data.text)
      }
    } finally {
      setRandomLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const fetchHistory = async (type, page = 1) => {
    setIsHistoryLoading(true)
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/rooms/history/questions?sessionToken=${sessionToken}&type=${type}&page=${page}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setHistoryData(data.questions)
        setHistoryTotal(data.total)
      }
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const openHistory = (type, setter) => {
    setHistoryType(type)
    setHistorySetter(() => setter)
    setHistoryPage(1)
    setShowHistory(true)
    fetchHistory(type, 1)
  }

  const handleSelectHistory = (text) => {
    if (historySetter) historySetter(text)
    setShowHistory(false)
  }

  const handleStartGame = () => {
    setIsStartLoading(true)
    startPlaying()
    setTimeout(() => setIsStartLoading(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 bg-white text-black font-sans">
      <h2 className="text-4xl font-black mb-8 uppercase tracking-tighter border-b-8 border-black">Write Phase</h2>

      {/* Status — ở đầu trang */}
      <div className="w-full max-w-lg mb-8">
        <h3 className="font-black text-2xl mb-4 uppercase border-b-4 border-black pb-2">Status</h3>
        <ul className="space-y-3">
          {room.players.map(p => (
            <li key={p.sessionToken} className="flex justify-between items-center p-4 border-4 border-black shadow-[4px_4px_0_0_#000] bg-white">
              <span className="font-bold text-lg truncate">{p.name} {p.sessionToken === sessionToken && <span className="text-gray-500 font-normal">(You)</span>}</span>
              <span className="text-2xl">
                {p.submittedQuestions ? <CheckCircle2 className="text-black" strokeWidth={3} /> : <Hourglass className="text-gray-400 animate-pulse" strokeWidth={3} />}
              </span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="w-full max-w-lg mb-8 p-6 border-4 border-black shadow-[4px_4px_0_0_#000] bg-white">
        {!me?.submittedQuestions ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* Serious Question */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-black text-xs uppercase opacity-70">Serious Question</label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    onClick={() => handleRandom('serious', setQ1, 'q1')}
                    variant="secondary"
                    className="px-3 py-1 text-[10px] shadow-[2px_2px_0_0_#000]"
                  >
                    <Dices size={12} /> Random
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => openHistory('serious', setQ1)}
                    variant="secondary"
                    className="px-3 py-1 text-[10px] shadow-[2px_2px_0_0_#000]"
                  >
                    <History size={12} /> History
                  </Button>
                </div>
              </div>
              <textarea value={q1} onChange={e => setQ1(e.target.value)} rows={2}
                className="w-full border-4 border-black p-3 text-sm outline-none focus:bg-gray-50 font-black uppercase placeholder-gray-400 resize-none"
                placeholder="Ex: What is your biggest regret?" required />
            </div>

            {/* Fun Question */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-black text-xs uppercase opacity-70">Fun Question</label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    onClick={() => handleRandom('fun', setQ2, 'q2')}
                    variant="secondary"
                    className="px-3 py-1 text-[10px] shadow-[2px_2px_0_0_#000]"
                  >
                    <Dices size={12} /> Random
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => openHistory('fun', setQ2)}
                    variant="secondary"
                    className="px-3 py-1 text-[10px] shadow-[2px_2px_0_0_#000]"
                  >
                    <History size={12} /> History
                  </Button>
                </div>
              </div>
              <textarea value={q2} onChange={e => setQ2(e.target.value)} rows={2}
                className="w-full border-4 border-black p-3 text-sm outline-none focus:bg-gray-50 font-black uppercase placeholder-gray-400 resize-none"
                placeholder="Ex: What animal would you ride into battle?" required />
            </div>

            {/* Normal Question */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-black text-xs uppercase opacity-70">Normal Question</label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    onClick={() => handleRandom('normal', setQ3, 'q3')}
                    variant="secondary"
                    className="px-3 py-1 text-[10px] shadow-[2px_2px_0_0_#000]"
                  >
                    <Dices size={12} /> Random
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => openHistory('normal', setQ3)}
                    variant="secondary"
                    className="px-3 py-1 text-[10px] shadow-[2px_2px_0_0_#000]"
                  >
                    <History size={12} /> History
                  </Button>
                </div>
              </div>
              <textarea value={q3} onChange={e => setQ3(e.target.value)} rows={2}
                className="w-full border-4 border-black p-3 text-sm outline-none focus:bg-gray-50 font-black uppercase placeholder-gray-400 resize-none"
                placeholder="Ex: What is your favorite movie?" required />
            </div>

            <Button 
              type="submit" 
              isLoading={isSubmitLoading} 
              className="p-6 text-xl mt-4"
            >
              Submit Questions
            </Button>
          </form>
        ) : (
          <div className="text-center py-12 animate-popinstay">
            <h3 className="text-3xl font-black uppercase mb-4 tracking-widest">Waiting...</h3>
            <p className="text-xl font-bold uppercase">Ready for battle</p>
          </div>
        )}
      </div>

      {isHost && (
        <div className="w-full max-w-lg mt-10">
          <Button 
            onClick={handleStartGame}
            isLoading={isStartLoading}
            className="w-full p-6 text-xl bg-green-500"
          >
            Start Playing
          </Button>
          <p className="text-center mt-4 font-black text-xs text-gray-400 uppercase tracking-widest">Wait until everyone submits</p>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-6 max-w-md w-full relative animate-popinstay">
            <button onClick={() => setShowHistory(false)} className="absolute top-2 right-2 p-2 hover:bg-gray-100 transition-colors">
              <X size={24} strokeWidth={3} />
            </button>
            <h3 className="text-2xl font-black uppercase mb-4 border-b-4 border-black pb-2 flex items-center gap-2">
              <History /> {historyType} History
            </h3>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {isHistoryLoading ? (
                <div className="text-center py-10 font-black animate-pulse uppercase">Loading History...</div>
              ) : historyData.length > 0 ? (
                historyData.map((h, i) => (
                  <button 
                    key={h._id || i}
                    onClick={() => handleSelectHistory(h.text)}
                    className="w-full text-left p-4 border-2 border-black hover:bg-yellow-50 font-bold text-sm uppercase transition-colors"
                  >
                    {h.text}
                  </button>
                ))
              ) : (
                <div className="text-center py-10 font-bold text-gray-400 uppercase">No history found for this type</div>
              )}
            </div>

            {/* Pagination */}
            {historyTotal > 10 && (
              <div className="flex justify-between items-center mt-6 pt-4 border-t-2 border-black">
                <Button 
                  variant="secondary" 
                  className="px-3 py-1 text-xs" 
                  disabled={historyPage === 1}
                  onClick={() => {
                    const newPage = historyPage - 1
                    setHistoryPage(newPage)
                    fetchHistory(historyType, newPage)
                  }}
                >
                  <ChevronLeft size={16} /> Previous
                </Button>
                <div className="font-black text-xs uppercase">
                  {historyPage} / {Math.ceil(historyTotal / 10)}
                </div>
                <Button 
                  variant="secondary" 
                  className="px-3 py-1 text-xs" 
                  disabled={historyPage >= Math.ceil(historyTotal / 10)}
                  onClick={() => {
                    const newPage = historyPage + 1
                    setHistoryPage(newPage)
                    fetchHistory(historyType, newPage)
                  }}
                >
                  Next <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
