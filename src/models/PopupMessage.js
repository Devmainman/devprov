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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('PopupMessage', popupMessageSchema);