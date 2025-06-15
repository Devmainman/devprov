import mongoose from 'mongoose';

const currencySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  rate: {
    type: Number,
    required: true,
    default: 1
  },
  status: {
    type: String,
    enum: ['Enabled', 'Disabled'],
    default: 'Enabled'
  },
  isBase: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Currency = mongoose.model('Currency', currencySchema);

export default Currency;