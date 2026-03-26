import mongoose from 'mongoose'
import QuestionBank from '../models/QuestionBank.js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gameroom'

// Instead of importing the React file, we'll just extract the arrays regex-wise or we can just run it since it's valid JS if we change the export.
// Actually, I'll just write the questions inline to guarantee it works.

import { questionBank } from '../../../client/src/lib/questionBank.js'

async function seed() {
  await mongoose.connect(MONGODB_URI)
  
  const docs = []
  for (const [type, questions] of Object.entries(questionBank)) {
    for (const text of questions) {
      docs.push({
        text,
        type,
        isUserSubmitted: false,
        stats: { deep: 0, funny: 0, good: 0, bad: 0 }
      })
    }
  }

  await QuestionBank.insertMany(docs)
  console.log(`Seeded ${docs.length} questions into QuestionBank`)
  await mongoose.disconnect()
}

seed().catch(console.error)
