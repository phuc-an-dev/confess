import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, RefreshCw, QrCode, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useGame } from '../context/GameContext'

export default function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { room, leaveRoom } = useGame()
  const [showQrModal, setShowQrModal] = useState(false)

  if (location.pathname === '/' || location.pathname === '/admin') return null

  const handleHome = () => {
    leaveRoom()
    navigate('/')
  }

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-16 bg-black text-white flex items-center justify-between px-4 z-50 shadow-[0_2px_0_0_#555]">
        <div className="flex gap-2">
          <button 
            onClick={handleHome} 
            className="p-2 hover:bg-white hover:text-black transition-colors rounded aspect-square flex items-center justify-center border-2 border-transparent hover:border-black"
            title="Go to Home"
          >
            <Home size={28} strokeWidth={2.5} />
          </button>
          
          {room?.code && (
            <button 
              onClick={() => setShowQrModal(true)} 
              className="p-2 hover:bg-white hover:text-black transition-colors rounded aspect-square flex items-center justify-center border-2 border-transparent hover:border-black"
              title="Show QR Code Invite"
            >
              <QrCode size={28} strokeWidth={2.5} />
            </button>
          )}
        </div>
        
        <button 
          onClick={handleReload} 
          className="p-2 hover:bg-white hover:text-black transition-colors rounded aspect-square flex items-center justify-center border-2 border-transparent hover:border-black"
          title="Reload Page"
        >
          <RefreshCw size={28} strokeWidth={2.5} />
        </button>
      </div>

      {showQrModal && room?.code && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white border-4 border-black shadow-[4px_4px_0_0_#000] p-8 max-w-md w-full relative flex flex-col items-center text-center animate-popinstay">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-2 right-2 p-2 hover:bg-gray-200 rounded transition-colors"
            >
              <X size={28} strokeWidth={3} />
            </button>
            <h2 className="text-3xl font-black uppercase mb-6 tracking-widest leading-none">Join Game</h2>
            <div className="border-4 border-black p-4 bg-white mb-6">
              <QRCodeSVG value={`${window.location.origin}/?join=${room.code}`} size={256} className="w-full h-auto max-w-[256px]" />
            </div>
            <p className="text-xl font-black font-mono bg-white px-6 py-2 border-4 border-black shadow-[2px_2px_0_0_#999]">
              {room.code}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
