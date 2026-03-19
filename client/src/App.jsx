import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GameProvider } from './context/GameContext.jsx'
import Home from './pages/Home.jsx'
import Lobby from './pages/Lobby.jsx'
import WriteQuestions from './pages/WriteQuestions.jsx'
import Playing from './pages/Playing.jsx'
import Results from './pages/Results.jsx'

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/writing" element={<WriteQuestions />} />
          <Route path="/playing" element={<Playing />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  )
}
