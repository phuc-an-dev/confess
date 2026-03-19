import { createServer } from 'http'
import { Server } from 'socket.io'
import { app } from './app.js'
import { registerHandlers } from './socket/index.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT || 3001
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gameroom'

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err))

const httpServer = createServer(app)

// Setup Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
})

// Register all socket connection events
registerHandlers(io)

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
