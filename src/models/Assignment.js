import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['popup_form', 'popup_invoice', 'popup_message'],
    required: true,
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'type',
  },
  title: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['assigned', 'completed', 'pending_payment', 'acknowledged'],
    default: 'assigned',
  },
  dueDate: {
    type: Date,
    default: () => Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  blockProgress: {
    type: Boolean,
    default: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

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

assignmentSchema.index({ userId: 1, type: 1, status: 1 });

export default mongoose.model('Assignment', assignmentSchema);