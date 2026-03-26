import { Check, ChevronLeft, ChevronRight, Edit2, Heart, RotateCcw, Search, Smile, ThumbsDown, ThumbsUp, Trash2, User, X } from 'lucide-react'
import { useState } from 'react'
import Button from '../components/Button'

export default function Admin() {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [questions, setQuestions] = useState([])
  const [filter, setFilter] = useState('newest') // newest, deep, funny, good, bad
  const [categoryFilter, setCategoryFilter] = useState('all') // all, serious, fun, normal
  const [searchName, setSearchName] = useState('')
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ text: '', type: '', stats: {} })
  
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [isLoginLoading, setIsLoginLoading] = useState(false)

  const fetchQuestions = async (pass) => {
    setIsLoginLoading(true)
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/questions', {
        headers: { 'x-admin-password': pass }
      })
      if (res.ok) {
        const data = await res.json()
        setQuestions(data.questions)
        setIsAuthenticated(true)
      } else {
        alert('Invalid password')
      }
    } catch (e) {
      alert('Connection error')
    } finally {
      setIsLoginLoading(false)
    }
  }

  const handleLogin = (e) => {
    e.preventDefault()
    fetchQuestions(password)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this question?')) return
    setIsActionLoading(true)
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/admin/questions/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password }
      })
      if (res.ok) {
        setQuestions(q => q.filter(x => x._id !== id))
      }
    } finally {
      setIsActionLoading(false)
    }
  }

  const startEdit = (q) => {
    setEditingId(q._id)
    setEditForm({ 
      text: q.text, 
      type: q.type, 
      stats: { ...q.stats } 
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id) => {
    setIsActionLoading(true)
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/admin/questions/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': password 
        },
        body: JSON.stringify(editForm)
      })
      if (res.ok) {
        const { question } = await res.json()
        setQuestions(qs => qs.map(q => q._id === id ? question : q))
        setEditingId(null)
      }
    } finally {
      setIsActionLoading(false)
    }
  }

  const resetFilters = () => {
    setFilter('newest')
    setCategoryFilter('all')
    setSearchName('')
    setCurrentPage(1)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-white border-4 border-black p-8 shadow-[4px_4px_0_0_#000] max-w-sm w-full animate-popinstay">
          <h1 className="text-3xl font-black uppercase mb-6 text-center tracking-widest">Admin Login</h1>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="w-full border-4 border-black p-3 mb-4 font-bold outline-none"
            placeholder="Enter Password"
          />
          <Button type="submit" isLoading={isLoginLoading} className="w-full">
            Access System
          </Button>
        </form>
      </div>
    )
  }

  let filtered = [...questions]
  if (categoryFilter !== 'all') filtered = filtered.filter(q => q.type === categoryFilter)
  if (searchName) filtered = filtered.filter(q => q.authorName && q.authorName.toLowerCase().includes(searchName.toLowerCase()))

  if (filter === 'deep') filtered.sort((a,b) => (b.stats?.deep || 0) - (a.stats?.deep || 0))
  else if (filter === 'funny') filtered.sort((a,b) => (b.stats?.funny || 0) - (a.stats?.funny || 0))
  else if (filter === 'good') filtered.sort((a,b) => (b.stats?.good || 0) - (a.stats?.good || 0))
  else if (filter === 'bad') filtered.sort((a,b) => (b.stats?.bad || 0) - (a.stats?.bad || 0))
  else filtered.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const displayed = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-center mb-8 border-b-4 border-black pb-6 gap-6">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-black">Control Panel</h1>
          
          <div className="flex flex-col gap-4 w-full lg:w-auto">
            <div className="flex gap-4">
              <div className="flex-1 relative border-4 border-black flex items-center bg-white px-3 focus-within:ring-4 ring-black/10">
                <Search size={20} className="text-gray-400 mr-2 shrink-0" strokeWidth={3} />
                <input 
                  value={searchName}
                  onChange={e => { setSearchName(e.target.value); setCurrentPage(1); }}
                  placeholder="Search Author Name..."
                  className="bg-transparent outline-none font-bold py-2 w-full min-w-[200px]"
                />
              </div>
              <Button onClick={resetFilters} variant="secondary" className="px-4">
                <RotateCcw size={20} />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="font-black uppercase text-xs w-full mb-1">Sort By Metrics</span>
              {['newest', 'deep', 'funny', 'good', 'bad'].map(f => (
                <button key={f} onClick={() => { setFilter(f); setCurrentPage(1); }}
                  className={`border-4 border-black px-4 py-1.5 font-black uppercase text-[10px] transition-colors ${filter === f ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-200 shadow-[2px_2px_0_0_#000]'}`}>
                  {f === 'newest' ? 'Newest' : f}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="font-black uppercase text-xs w-full mb-1">Filter Category</span>
              {['all', 'serious', 'fun', 'normal'].map(c => (
                <button key={c} onClick={() => { setCategoryFilter(c); setCurrentPage(1); }}
                  className={`border-4 border-black px-4 py-1.5 font-black uppercase text-[10px] transition-colors ${categoryFilter === c ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-200 shadow-[2px_2px_0_0_#000]'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayed.map(q => (
            <div key={q._id} className="border-4 border-black p-6 relative bg-white shadow-[4px_4px_0_0_#000] flex flex-col group transition-transform hover:-translate-y-1">
              
              {q.isUserSubmitted && (
                <span className="absolute -top-5 left-4 bg-white border-4 border-black px-4 py-1 font-black text-[10px] uppercase shadow-[2px_2px_0_0_#000] flex items-center gap-1">
                  <User size={12} /> {q.authorName || 'User'}
                </span>
              )}

              {editingId === q._id ? (
                <div className="flex-1 flex flex-col gap-4 mt-4">
                  <textarea 
                    value={editForm.text}
                    onChange={e => setEditForm({...editForm, text: e.target.value})}
                    className="w-full border-4 border-black p-3 font-bold uppercase outline-none bg-gray-50 h-32"
                  />
                  <div className="flex gap-2">
                    {['serious', 'fun', 'normal'].map(type => (
                      <button key={type} onClick={() => setEditForm({...editForm, type})}
                        className={`flex-1 border-4 border-black p-2 font-black text-[10px] uppercase ${editForm.type === type ? 'bg-black text-white' : 'bg-white'}`}>
                        {type}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {['deep', 'funny', 'good', 'bad'].map(stat => (
                      <div key={stat} className="flex flex-col border-4 border-black bg-gray-50 p-2">
                        <label className="text-[10px] font-black uppercase mb-1">{stat}</label>
                        <input type="number" value={editForm.stats[stat] || 0}
                          onChange={e => setEditForm({...editForm, stats: { ...editForm.stats, [stat]: parseInt(e.target.value) || 0 }})}
                          className="bg-transparent font-black outline-none border-t-2 border-black pt-1"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-2">
                    <Button onClick={() => saveEdit(q._id)} isLoading={isActionLoading} className="flex-1 py-2 text-xs">
                      <Check size={16} /> Save
                    </Button>
                    <Button onClick={cancelEdit} variant="secondary" className="flex-1 py-2 text-xs shadow-none border-gray-400">
                      <X size={16} /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 mb-6 mt-4">
                    <span className="inline-block border-4 border-black px-3 py-1 text-[10px] font-black uppercase mb-4 shadow-[2px_2px_0_0_#000] bg-black text-white">
                      {q.type}
                    </span>
                    <p className="font-black text-xl uppercase leading-tight italic">"{q.text}"</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t-2 border-black border-dashed">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                      <Heart size={12} className="text-gray-400" />
                      <span>Deep: {q.stats?.deep || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                      <Smile size={12} className="text-gray-400" />
                      <span>Funny: {q.stats?.funny || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                      <ThumbsUp size={12} className="text-gray-400" />
                      <span>Good: {q.stats?.good || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                      <ThumbsDown size={12} className="text-gray-400" />
                      <span>Bad: {q.stats?.bad || 0}</span>
                    </div>
                  </div>

                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(q)} className="p-2 bg-black text-white border-2 border-white shadow-[2px_2px_0_0_#000] hover:bg-gray-800 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(q._id)} className="p-2 bg-black text-white border-2 border-white shadow-[2px_2px_0_0_#000] hover:bg-gray-800 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-12 flex justify-center items-center gap-4">
            <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="secondary" className="p-3 shadow-[2px_2px_0_0_#000]"><ChevronLeft size={24} /></Button>
            <span className="font-black text-xl bg-white border-4 border-black px-6 py-2 shadow-[4px_4px_0_0_#000]">{currentPage} / {totalPages}</span>
            <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="secondary" className="p-3 shadow-[2px_2px_0_0_#000]"><ChevronRight size={24} /></Button>
          </div>
        )}
      </div>
    </div>
  )
}
