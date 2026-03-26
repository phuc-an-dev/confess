import { Router } from 'express'
import QuestionBank from '../models/QuestionBank.js'

const router = Router()

// Simple middleware to check admin password
const requireAdmin = (req, res, next) => {
  const password = req.headers['x-admin-password']
  if (password !== 'admin123') { // hardcoded for MVP as planned
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

router.use(requireAdmin)

router.get('/questions', async (req, res) => {
  const questions = await QuestionBank.find().sort({ createdAt: -1 })
  res.json({ questions })
})

router.post('/questions', async (req, res) => {
  const { text, type, isUserSubmitted, authorIp } = req.body
  const question = await QuestionBank.create({ text, type, isUserSubmitted, authorIp })
  res.status(201).json({ question })
})

router.put('/questions/:id', async (req, res) => {
  const { text, type, stats } = req.body
  const updateData = { text, type }
  if (stats) updateData.stats = stats
  
  const question = await QuestionBank.findByIdAndUpdate(req.params.id, updateData, { new: true })
  if (!question) return res.status(404).json({ error: 'Not found' })
  res.json({ question })
})

router.delete('/questions/:id', async (req, res) => {
  const question = await QuestionBank.findByIdAndDelete(req.params.id)
  if (!question) return res.status(404).json({ error: 'Not found' })
  res.json({ success: true })
})

export default router
