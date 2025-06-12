// models/PopupMessage.js
import mongoose from 'mongoose';

const popupMessageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { 
    type: String, 
    enum: ['Active', 'Inactive', 'Draft'], 
    default: 'Draft' 
  },
  file: String,
  filePath: String,
  notificationType: {
    type: String,
    enum: ['notification', 'email', 'both'],
    default: 'notification',
  },
  acknowledged: {
    type: Boolean,
    default: false,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

popupMessageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('PopupMessage', popupMessageSchema);