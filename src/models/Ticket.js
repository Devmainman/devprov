import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['user', 'support'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  attachments: [{ type: String }], // Store file paths or URLs
});

const ticketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
  status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  messages: [messageSchema],
  customer: {
    name: String,
    email: String,
    accountType: String,
  },
});

export default mongoose.model('Ticket', ticketSchema);