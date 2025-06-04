// models/PopupInvoice.js
import mongoose from 'mongoose';

const popupInvoiceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  amount: { type: String, required: true },
  currency: { type: String, default: 'USD' },
  description: String,
  assignedTo: { 
    type: String, 
    enum: ['All Users', 'Withdrawal', 'Signal Strength'], 
    default: 'All Users' 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive', 'Draft'], 
    default: 'Draft' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('PopupInvoice', popupInvoiceSchema);