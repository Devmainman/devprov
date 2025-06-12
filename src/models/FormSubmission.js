// models/FormSubmission.js
import mongoose from 'mongoose';

const formSubmissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PopupForm',
    required: true,
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true,
  },
  data: [{
    fieldName: { type: String, required: true },
    value: mongoose.Schema.Types.Mixed,
    error: String,
  }],
  status: {
    type: String,
    enum: ['submitted', 'reviewed', 'rejected'],
    default: 'submitted',
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

formSubmissionSchema.index({ userId: 1, formId: 1, assignmentId: 1 });

export default mongoose.model('FormSubmission', formSubmissionSchema);