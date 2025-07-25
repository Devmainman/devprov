import mongoose from 'mongoose';

const withdrawalMethodSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    default: 'Default'
  },
  methodId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  requiredSignal: {
    type: Number,
    default: 100,
    min: 1,
    max: 100
  },  
  minAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
  },
  
  maxAmount: {
    type: Number,
    required: true
  },
  details: [{
    label: {
      type: String,
      required: true
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Pre-save hook to generate methodId if not provided
withdrawalMethodSchema.pre('save', function(next) {
  if (!this.methodId) {
    this.methodId = this.title.toLowerCase().replace(/\s+/g, '_');
  }
  next();
});

const WithdrawalMethod = mongoose.model('WithdrawalMethod', withdrawalMethodSchema);

export default WithdrawalMethod;