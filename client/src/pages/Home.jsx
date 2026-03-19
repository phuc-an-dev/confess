import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function Home() {
  const [name, setName] = useState('')
  const [searchParams] = useSearchParams()
  const initialCode = searchParams.get('join') || ''
  const [code, setCode] = useState(initialCode)
  const { joinRoom } = useGame()
  const navigate = useNavigate()

  const handleCreate = async () => {
    if (!name) return alert('Enter name')
    const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName: name })
    })
    const data = await res.json()
    joinRoom(data.code, name)
    navigate('/lobby')
  }

  const handleJoin = () => {
    if (!name || !code) return alert('Enter name and code')
    joinRoom(code, name)
    navigate('/lobby')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white text-black font-sans">
      <h1 className="text-4xl font-bold mb-8">GAME ROOM</h1>
      <div className="w-full max-w-sm space-y-4">
        <input 
          className="w-full border-4 border-black p-3 font-bold placeholder-gray-500" 
          placeholder="Your Name" 
          value={name} onChange={e => setName(e.target.value)} 
        />
        <div className="flex gap-2">
          <input 
            className="flex-1 border-4 border-black p-3 font-bold uppercase font-mono placeholder-gray-500" 
            placeholder="Code" 
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button className="bg-black text-white px-6 font-bold uppercase tracking-widest border-4 border-black hover:bg-white hover:text-black transition-colors" onClick={handleJoin}>Join</button>
        </div>
        <div className="text-center my-4 font-bold text-lg">OR</div>
        <button className="w-full border-4 border-black p-4 font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors" onClick={handleCreate}>
          Create New Room
        </button>
      </div>
    </div>
  )
}
