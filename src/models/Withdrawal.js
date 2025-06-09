import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  method: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WithdrawalMethod',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending'
  },
  details: [{
    label: String,
    value: String
  }],
  adminNotes: String,
  receipt: { 
    type: String, 
    trim: true, 
    default: '' // Store file path or URL
  }
}, { timestamps: true });

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

export default Withdrawal;