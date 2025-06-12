// models/PopupInvoice.js
import mongoose from 'mongoose';

const popupInvoiceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },
  description: String,
  assignedTo: { 
    type: String, 
    enum: ['All Users', 'Withdrawal', 'Signal Strength'], 
    default: 'All Users' 
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'pending', 'paid', 'failed'],
    default: 'unpaid',
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive', 'Draft'], 
    default: 'Draft' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

popupInvoiceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('PopupInvoice', popupInvoiceSchema);