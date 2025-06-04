// models/Package.js
import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    trim: true
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'NGN'] // Add other currencies as needed
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  benefits: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length > 0 && v.every(b => b.trim().length > 0);
      },
      message: 'At least one benefit is required'
    }
  },
  threshold: {
    type: Number,
    min: 0
  },
  requiredSignal: {
    type: Number,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
packageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Package = mongoose.model('Package', packageSchema);

export default Package;