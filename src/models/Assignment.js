// models/Assignment.js
import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  type: {
    type: String,
    enum: ['popup_message', 'popup_form', 'popup_invoice', 'package'],
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  status: {
    type: String,
    enum: ['assigned', 'completed', 'pending_payment', 'expired', 'disabled'],
    default: 'assigned'
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  notes: String,
  dueDate: Date
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals for populating the actual item
assignmentSchema.virtual('popupMessage', {
  ref: 'PopupMessage',
  localField: 'itemId',
  foreignField: '_id',
  justOne: true
});

assignmentSchema.virtual('popupForm', {
  ref: 'PopupForm',
  localField: 'itemId',
  foreignField: '_id',
  justOne: true
});

assignmentSchema.virtual('popupInvoice', {
  ref: 'PopupInvoice',
  localField: 'itemId',
  foreignField: '_id',
  justOne: true
});

assignmentSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

export default mongoose.model('Assignment', assignmentSchema);