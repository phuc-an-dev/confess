import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../components/Button'

export default function Home() {
  const [name, setName] = useState(() => localStorage.getItem('playerName') || '')
  const [searchParams] = useSearchParams()
  const initialCode = searchParams.get('join') || ''
  const [code, setCode] = useState(initialCode)
  const { joinRoom } = useGame()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async () => {
    if (!name) return alert('Enter name')
    setIsLoading(true)
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: name })
      })
      const data = await res.json()
      joinRoom(data.code, name)
      navigate('/lobby')
    } catch (e) {
      alert('Failed to create room')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoin = () => {
    if (!name || !code) return alert('Enter name and code')
    setIsLoading(true)
    joinRoom(code, name)
    setTimeout(() => {
      navigate('/lobby')
      setIsLoading(false)
    }, 500)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white text-black font-sans">
      <h1 className="text-4xl font-black mb-8 uppercase tracking-widest border-b-8 border-black">GAME ROOM</h1>
      <div className="w-full max-w-sm space-y-4">
        <input 
          className="w-full border-4 border-black p-4 font-black uppercase placeholder-gray-400 outline-none focus:bg-gray-50" 
          placeholder="Your Name" 
          value={name} onChange={e => setName(e.target.value)} 
        />
        <div className="flex gap-2">
          <input 
            className="flex-1 border-4 border-black p-4 font-black uppercase font-mono placeholder-gray-400 outline-none focus:bg-gray-50" 
            placeholder="Code" 
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <Button onClick={handleJoin} isLoading={isLoading} className="px-8">Join</Button>
        </div>
        <div className="text-center my-6 font-black text-xl uppercase italic">OR</div>
        <Button onClick={handleCreate} isLoading={isLoading} variant="secondary" className="w-full p-6 text-xl">
          Create New Room
        </Button>
      </div>
    </div>
  )
}
