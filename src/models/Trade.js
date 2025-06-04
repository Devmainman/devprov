import mongoose from 'mongoose';

const tradeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  profit: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'paused', 'terminated'],
    default: 'pending'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  active: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Add indexes for better performance
tradeSchema.index({ userId: 1, status: 1 });
tradeSchema.index({ startDate: -1 });

const Trade = mongoose.model('Trade', tradeSchema);

export default Trade;