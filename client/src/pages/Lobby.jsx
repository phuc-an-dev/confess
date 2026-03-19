import { useGame } from '../context/GameContext.jsx'
import { Navigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'

export default function Lobby() {
  const { room, error, sessionToken, startWriting } = useGame()

  if (error) return <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center"><div className="border-4 border-red-500 p-4 text-red-500 font-bold mb-4 bg-red-50">Error: {error}</div><a href="/" className="font-bold underline decoration-4 hover:bg-black hover:text-white p-2 transition-all">Go Back</a></div>
  if (!room) return <div className="min-h-screen flex items-center justify-center p-4 font-bold animate-pulse text-2xl">Loading...</div>
  
  if (room.status === 'writing') return <Navigate to="/writing" />
  if (room.status === 'playing') return <Navigate to="/playing" />

  const isHost = room.hostSessionToken === sessionToken
  const joinUrl = `${window.location.origin}/?join=${room.code}`

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 bg-white text-black font-sans">
      <h2 className="text-4xl font-black mb-8 uppercase tracking-tighter">Lobby</h2>
      
      <div className="border-8 border-black p-8 flex flex-col items-center mb-8 shadow-[8px_8px_0_0_#000] bg-white">
        <div className="text-6xl font-mono font-black tracking-[0.2em] mb-6">{room.code}</div>
        <div className="border-4 border-black p-2 bg-white">
          <QRCodeSVG value={joinUrl} size={180} />
        </div>
      </div>

      <div className="w-full max-w-sm">
        <h3 className="font-black text-2xl mb-4 uppercase flex justify-between items-end border-b-4 border-black pb-2">
          Players <span className="text-lg bg-black text-white px-2 py-1">{room.players.length}</span>
        </h3>
        <ul className="space-y-3">
          {room.players.map(p => (
            <li key={p.sessionToken} className="flex justify-between items-center p-4 border-4 border-black shadow-[4px_4px_0_0_#000] bg-white">
              <span className="font-bold text-lg max-w-[200px] truncate">{p.name} {p.sessionToken === sessionToken && <span className="text-gray-500 font-normal">(You)</span>}</span>
              {p.sessionToken === room.hostSessionToken && <span className="bg-black text-white px-3 py-1 font-bold uppercase tracking-widest text-xs">Host</span>}
            </li>
          ))}
        </ul>

        {isHost && (
          <button className="w-full bg-black text-white font-black text-xl p-6 mt-10 uppercase tracking-widest hover:bg-white hover:text-black border-4 border-black transition-colors"
                  onClick={() => startWriting()}>
            Start Writing
          </button>
        )}
      </div>
    </div>
  )
}
