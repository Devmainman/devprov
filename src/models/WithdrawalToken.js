import mongoose from 'mongoose';

const withdrawalTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['Used', 'Unused'],
    default: 'Unused'
  },
  date: {
    type: Date,
    default: Date.now
  },
  accountId: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const WithdrawalToken = mongoose.model('WithdrawalToken', withdrawalTokenSchema);
export default WithdrawalToken;
