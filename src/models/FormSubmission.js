// models/FormSubmission.js
import mongoose from 'mongoose';

const responseSchema = new mongoose.Schema({
  fieldId: { type: mongoose.Schema.Types.ObjectId, required: true },
  label: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed
}, { _id: false });

const formSubmissionSchema = new mongoose.Schema({
  form: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'PopupForm',
    required: true 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  responses: [responseSchema],
  submittedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

export default mongoose.model('FormSubmission', formSubmissionSchema);