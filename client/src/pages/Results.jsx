import { useGame } from '../context/GameContext.jsx'
import { Navigate, useNavigate } from 'react-router-dom'

export default function Results() {
  const { room } = useGame()
  const navigate = useNavigate()

  if (!room) return <Navigate to="/" />

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white text-black font-sans">
      <div className="border-8 border-black p-12 md:p-16 text-center shadow-[16px_16px_0_0_#000]">
        <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-6 border-b-8 border-black pb-4">GAME OVER</h1>
        <p className="text-2xl md:text-4xl font-bold uppercase mb-12 flex justify-center items-center gap-4">
          Total Questions Played: <span className="bg-black text-white px-4 py-2 text-4xl">{room.questions ? room.questions.length : 0}</span>
        </p>
        
        <button 
          onClick={() => navigate('/')} 
          className="w-full bg-black text-white p-6 md:p-8 font-black text-2xl md:text-3xl uppercase tracking-[0.2em] border-8 border-black hover:bg-white hover:text-black transition-colors shadow-[8px_8px_0_0_#000]"
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}
