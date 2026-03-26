import { Router } from 'express'
import Room from '../models/Room.js'
import QuestionBank from '../models/QuestionBank.js'
import { generateCode } from '../lib/codeGenerator.js'

const router = Router()

router.get('/random-question', async (req, res) => {
  const { type } = req.query
  if (!type) return res.status(400).json({ error: 'type required' })
  const result = await QuestionBank.aggregate([
    { $match: { type, isUserSubmitted: false } },
    { $sample: { size: 1 } }
  ])
  if (result.length > 0) {
    res.json({ text: result[0].text })
  } else {
    res.status(404).json({ error: 'Not found' })
  }
})

router.post('/', async (req, res) => {
  const { hostName } = req.body
  if (!hostName) {
    return res.status(400).json({ error: 'hostName is required' })
  }
  
  const code = generateCode()
  
  const room = await Room.create({
    code,
    status: 'lobby'
  })
  
  res.status(201).json({ code: room.code })
})

router.get('/:code', async (req, res) => {
  const code = req.params.code
  const room = await Room.findOne({ code })
  if (!room) {
    return res.status(404).json({ error: 'Room not found' })
  }
  res.status(200).json({ status: room.status })
})

router.get('/history/questions', async (req, res) => {
  const { sessionToken, page = 1, limit = 10, type } = req.query
  if (!sessionToken) return res.status(400).json({ error: 'sessionToken required' })
  
  const query = { authorSessionToken: sessionToken }
  if (type) query.type = type

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [questions, total] = await Promise.all([
      QuestionBank.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      QuestionBank.countDocuments(query)
    ])
    
    res.json({ questions, total })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
