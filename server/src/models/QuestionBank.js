import mongoose from 'mongoose'

const questionBankSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ['serious', 'fun', 'normal'], default: 'normal' },
  isUserSubmitted: { type: Boolean, default: false },
  authorIp: { type: String, default: null },
  authorName: { type: String, default: null },
  authorSessionToken: { type: String, default: null },
  stats: {
    deep: { type: Number, default: 0 },
    funny: { type: Number, default: 0 },
    good: { type: Number, default: 0 },
    bad: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.model('QuestionBank', questionBankSchema)
