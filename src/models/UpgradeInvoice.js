import mongoose from 'mongoose';

const upgradeInvoiceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userSnapshot: {
    accountId: String,
    fullName: String,
    email: String
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  packageSnapshot: {
    name: String,
    amount: Number,
    currency: String
  },
  date: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'NGN'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'disputed'],
    default: 'pending'
  },
  paymentProof: {
    type: String,
    required: true
  },
  receipt: {
    type: String
  },
  disputeReason: {
    type: String
  },
  adminNotes: {
    type: String
  },
  transactionReference: {
  type: String,
  required: true,
  unique: true
}
}, { timestamps: true });


// Virtual for formatted amount display
upgradeInvoiceSchema.virtual('formattedAmount').get(function() {
  return `${this.amount} ${this.currency}`;
});

// Virtual for disputed status
upgradeInvoiceSchema.virtual('disputed').get(function() {
  return this.status === 'disputed';
});

const UpgradeInvoice = mongoose.model('UpgradeInvoice', upgradeInvoiceSchema);

export default UpgradeInvoice;