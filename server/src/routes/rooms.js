import { Router } from 'express'
import Room from '../models/Room.js'
import { generateCode } from '../lib/codeGenerator.js'

const router = Router()

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

export default router
