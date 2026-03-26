import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app.js'
import mongoose from 'mongoose'
import QuestionBank from '../../src/models/QuestionBank.js'

describe('Admin API - Question Bank', () => {
  beforeEach(async () => {
    await QuestionBank.deleteMany({})
  })

  it('fails to get questions without admin password', async () => {
    const res = await request(app).get('/api/admin/questions')
    expect(res.status).toBe(401)
  })

  it('gets all questions with correct password', async () => {
    await QuestionBank.create({ text: 'Sample Q?', type: 'normal' })
    const res = await request(app)
      .get('/api/admin/questions')
      .set('x-admin-password', 'admin123') // simple hardcoded check for MVP
    
    expect(res.status).toBe(200)
    expect(res.body.questions).toHaveLength(1)
  })

  it('adds a new question', async () => {
    const res = await request(app)
      .post('/api/admin/questions')
      .set('x-admin-password', 'admin123')
      .send({ text: 'New Q?', type: 'serious' })
      
    expect(res.status).toBe(201)
    
    const dbQuestion = await QuestionBank.findOne({ text: 'New Q?' })
    expect(dbQuestion).toBeDefined()
    expect(dbQuestion.type).toBe('serious')
  })

  it('deletes a question', async () => {
    const q = await QuestionBank.create({ text: 'Delete me', type: 'fun' })
    const res = await request(app)
      .delete(`/api/admin/questions/${q._id}`)
      .set('x-admin-password', 'admin123')
      
    expect(res.status).toBe(200)
    
    const count = await QuestionBank.countDocuments()
    expect(count).toBe(0)
  })

  it('updates a question', async () => {
    const q = await QuestionBank.create({ text: 'Old Q', type: 'fun' })
    const res = await request(app)
      .put(`/api/admin/questions/${q._id}`)
      .set('x-admin-password', 'admin123')
      .send({ text: 'Updated Q', type: 'serious' })
      
    expect(res.status).toBe(200)
    
    const updated = await QuestionBank.findById(q._id)
    expect(updated.text).toBe('Updated Q')
    expect(updated.type).toBe('serious')
  })
})
