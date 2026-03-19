import express from 'express'
import cors from 'cors'
import roomsRouter from './routes/rooms.js'

export const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/rooms', roomsRouter)
