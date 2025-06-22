import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    set: (value) => {
      if (typeof value === 'string') {
        return new mongoose.Types.ObjectId(value);
      }
      return value;
    }
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'NGN',
    uppercase: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'transfer', 'trade', 'admin_credit', 'admin_debit', 'currency_conversion'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  bankName: String,
  accountName: String,
  accountNumber: String,
  reference: {
    type: String,
    unique: true
  },
  metadata: mongoose.Schema.Types.Mixed
}, { 
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

// Indexes for better query performance
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;