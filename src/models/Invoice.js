import mongoose from 'mongoose';

const InvoiceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  accountId: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
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
    enum: ['USD', 'EUR', 'GBP', 'NGN', 'BTC', 'ETH']
  },
  entity: {
    type: String,
    required: true,
    enum: ['User', 'Vendor', 'Partner', 'Contractor']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected', 'disputed'],
    default: 'pending'
  },
  paymentProof: {
    type: String,
    required: true
  },
  disputeReason: {
    type: String,
    default: ''
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

const Invoice = mongoose.model('Invoice', InvoiceSchema);

export default Invoice;