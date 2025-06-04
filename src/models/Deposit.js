import mongoose from 'mongoose';

const depositSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentMethodId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    uppercase: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  paymentProof: {
    type: String,
    required: true
  },
  transactionReference: {
    type: String,
    required: true,
    unique: true
  },
  adminNotes: String,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// Indexes for better query performance
depositSchema.index({ userId: 1, status: 1 });
depositSchema.index({ createdAt: -1 });

const Deposit = mongoose.model('Deposit', depositSchema);

export default Deposit;