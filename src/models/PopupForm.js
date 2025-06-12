import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Unique identifier for the field
  label: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['text', 'input', 'textarea', 'select', 'checkbox', 'radio', 'number', 'file', 'email', 'date'] 
  },
  required: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  placeholder: String,
  defaultValue: mongoose.Schema.Types.Mixed,
  options: [{
    value: String,
    label: String
  }],
  validation: {
    pattern: String,
    min: Number,
    max: Number,
    minLength: Number,
    maxLength: Number
  }
}, { _id: false });

const popupFormSchema = new mongoose.Schema({
  title: { type: String, required: true },
  icon: String,
  description: String,
  status: { 
    type: String, 
    enum: ['Active', 'Inactive', 'Draft'], 
    default: 'Draft' 
  },
  fields: { type: [fieldSchema], default: [] },
  submitText: { type: String, default: 'Submit' },
  successMessage: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

popupFormSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('PopupForm', popupFormSchema);