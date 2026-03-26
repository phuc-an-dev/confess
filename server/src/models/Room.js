import mongoose from 'mongoose'

const roomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  status: { type: String, default: 'lobby' },
  hostSessionToken: { type: String }, // set when first player joins
  players: [{
    sessionToken: String,
    socketId: String,
    name: String,
    ipAddress: String, // [NEW] added for tracking
    submittedQuestions: { type: Boolean, default: false },
    isSpectator: { type: Boolean, default: false }
  }],
  questions: [{
    questionBankId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' }, // [NEW] link to global bank
    authorSessionToken: String,
    text: String,
    type: { type: String },
    used: { type: Boolean, default: false },
    ratings: [{
      playerSessionToken: String,
      type: { type: String, enum: ['deep', 'funny', 'good', 'bad'] }
    }]
  }],
  turnOrder: [String],
  currentTurnIndex: { type: Number, default: 0 },
  currentQuestion: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdAt: { type: Date, default: Date.now }
})

roomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 })

export default mongoose.model('Room', roomSchema)
