import { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { Navigate } from 'react-router-dom'
import { getRandomQuestion } from '../lib/questionBank.js'

export default function WriteQuestions() {
  const { room, sessionToken, submitQuestions, startPlaying, error } = useGame()
  
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')

  if (error) return <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center"><div className="border-4 border-red-500 p-4 text-red-500 font-bold mb-4 bg-red-50">Error: {error}</div><a href="/" className="font-bold underline decoration-4 hover:bg-black hover:text-white p-2 transition-all">Go Back</a></div>
  if (!room) return <div className="min-h-screen flex items-center justify-center p-4 font-bold animate-pulse text-2xl">Loading...</div>
  
  if (room.status === 'lobby') return <Navigate to="/lobby" />
  if (room.status === 'playing') return <Navigate to="/playing" />

  const isHost = room.hostSessionToken === sessionToken
  const me = room.players.find(p => p.sessionToken === sessionToken)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!q1.trim() || !q2.trim() || !q3.trim()) return
    submitQuestions([
      { text: q1, type: 'serious' },
      { text: q2, type: 'fun' },
      { text: q3, type: 'normal' }
    ])
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 bg-white text-black font-sans">
      <h2 className="text-4xl font-black mb-8 uppercase tracking-tighter">Write Phase</h2>

      {/* Status — ở đầu trang */}
      <div className="w-full max-w-lg mb-8">
        <h3 className="font-black text-2xl mb-4 uppercase border-b-4 border-black pb-2">Status</h3>
        <ul className="space-y-3">
          {room.players.map(p => (
            <li key={p.sessionToken} className="flex justify-between items-center p-4 border-4 border-black shadow-[4px_4px_0_0_#000] bg-white">
              <span className="font-bold text-lg truncate">{p.name} {p.sessionToken === sessionToken && <span className="text-gray-500 font-normal">(You)</span>}</span>
              <span className="text-2xl">{p.submittedQuestions ? '✅' : '⏳'}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="w-full max-w-lg mb-8 p-6 border-8 border-black shadow-[8px_8px_0_0_#000] bg-white">
        {!me?.submittedQuestions ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* Serious Question */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-bold text-sm uppercase">Serious Question</label>
                <button type="button" onClick={() => setQ1(getRandomQuestion('serious'))}
                  className="border-4 border-black px-3 py-1 bg-yellow-300 hover:bg-yellow-400 font-black text-sm uppercase tracking-wide transition-colors">
                  🎲 Random
                </button>
              </div>
              <textarea value={q1} onChange={e => setQ1(e.target.value)} rows={2}
                className="w-full border-4 border-black p-3 text-sm outline-none focus:bg-yellow-50 font-medium placeholder-gray-400 resize-none"
                placeholder="Ex: What is your biggest regret?" required />
            </div>

            {/* Fun Question */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-bold text-sm uppercase">Fun Question</label>
                <button type="button" onClick={() => setQ2(getRandomQuestion('fun'))}
                  className="border-4 border-black px-3 py-1 bg-pink-300 hover:bg-pink-400 font-black text-sm uppercase tracking-wide transition-colors">
                  🎲 Random
                </button>
              </div>
              <textarea value={q2} onChange={e => setQ2(e.target.value)} rows={2}
                className="w-full border-4 border-black p-3 text-sm outline-none focus:bg-pink-50 font-medium placeholder-gray-400 resize-none"
                placeholder="Ex: What animal would you ride into battle?" required />
            </div>

            {/* Normal Question */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-bold text-sm uppercase">Normal Question</label>
                <button type="button" onClick={() => setQ3(getRandomQuestion('normal'))}
                  className="border-4 border-black px-3 py-1 bg-blue-300 hover:bg-blue-400 font-black text-sm uppercase tracking-wide transition-colors">
                  🎲 Random
                </button>
              </div>
              <textarea value={q3} onChange={e => setQ3(e.target.value)} rows={2}
                className="w-full border-4 border-black p-3 text-sm outline-none focus:bg-blue-50 font-medium placeholder-gray-400 resize-none"
                placeholder="Ex: What is your favorite movie?" required />
            </div>

            <button 
              type="submit" 
              className="w-full bg-black text-white font-black text-2xl p-6 mt-4 uppercase tracking-widest hover:bg-white hover:text-black border-4 border-black transition-colors"
            >
              Submit
            </button>
          </form>
        ) : (
          <div className="text-center py-12 animate-pulse">
            <h3 className="text-3xl font-black uppercase mb-4">Waiting...</h3>
            <p className="text-xl font-bold">Waiting for other players to submit</p>
          </div>
        )}
      </div>



      {isHost && (
        <div className="w-full max-w-lg mt-10">
          <button 
            onClick={() => startPlaying()}
            className="w-full bg-green-500 text-black font-black text-xl p-6 uppercase tracking-widest hover:bg-white border-4 border-black transition-colors"
          >
            Start Playing
          </button>
          <p className="text-center mt-2 font-bold text-sm text-gray-500">Wait until everyone submits before starting to avoid empty question pools.</p>
        </div>
      )}
    </div>
  )
}
