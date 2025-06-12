import mongoose from 'mongoose';

const paymentMethodSchema = new mongoose.Schema({
  methodId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String, // Store file path (e.g., '/icons/filename.png')
    required: false // Optional, as some methods might not have custom icons
  },
  isActive: {
    type: Boolean,
    default: true
  },
  details: [{
    label: String,
    value: String,
    isSensitive: { type: Boolean, default: false } // For masking in UI
  }],
  instructions: String,
  minAmount: Number,
  maxAmount: Number,
  processingTime: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
paymentMethodSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);

export default PaymentMethod;