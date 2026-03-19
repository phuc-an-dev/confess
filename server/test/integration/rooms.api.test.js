import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app.js'

describe('POST /api/rooms', () => {
  it('returns a 6-char uppercase code', async () => {
    const res = await request(app).post('/api/rooms').send({ hostName: 'Alice' })
    expect(res.status).toBe(201)
    expect(res.body.code).toMatch(/^[A-Z]{6}$/)
  })

  it('returns 400 if hostName missing', async () => {
    const res = await request(app).post('/api/rooms').send({})
    expect(res.status).toBe(400)
  })
})

describe('GET /api/rooms/:code', () => {
  it('returns lobby status for valid code', async () => {
    const { body } = await request(app).post('/api/rooms').send({ hostName: 'Alice' })
    const res = await request(app).get(`/api/rooms/${body.code}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('lobby')
  })

  it('returns 404 for unknown code', async () => {
    const res = await request(app).get('/api/rooms/XXXXXX')
    expect(res.status).toBe(404)
  })
})
