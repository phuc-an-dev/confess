import express from 'express'
import cors from 'cors'
import roomsRouter from './routes/rooms.js'
import adminRouter from './routes/admin.js'

export const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/rooms', roomsRouter)
app.use('/api/admin', adminRouter)
