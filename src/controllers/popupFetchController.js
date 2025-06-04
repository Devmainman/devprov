import PopupForm from '../models/PopupForm.js';
import PopupInvoice from '../models/PopupInvoice.js';
import PopupMessage from '../models/PopupMessage.js';
import FormSubmission from '../models/FormSubmission.js';
import User from '../models/User.js';
import Assignment from '../models/Assignment.js';
import { sendNotification } from '../app.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// Configure __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fetch assigned popup forms
export const getAvailablePopupForms = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware

    // Find assignments for the user with type 'popup_form'
    const assignments = await Assignment.find({
      userId,
      type: 'popup_form',
      status: { $in: ['assigned', 'pending'] }
    }).select('itemId');

    const formIds = assignments.map(assignment => assignment.itemId);

    // Fetch active forms that are assigned to the user
    const forms = await PopupForm.find({
      _id: { $in: formIds },
      status: 'Active'
    }).select('title description fields status icon createdAt');

    res.json({
      success: true,
      forms
    });
  } catch (err) {
    console.error('Error fetching forms:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching forms' 
    });
  }
};

// Fetch active popup invoices
export const getAvailablePopupInvoices = async (req, res) => {
  try {
    const invoices = await PopupInvoice.find({ status: 'Active' })
      .select('title amount currency description assignedTo status createdAt');
    res.json({
      success: true,
      invoices
    });
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching invoices' 
    });
  }
};

// Fetch active popup messages
export const getAvailablePopupMessages = async (req, res) => {
  try {
    const messages = await PopupMessage.find({ status: 'Active' })
      .select('title description file filePath status createdAt');
    res.json({
      success: true,
      messages
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching messages' 
    });
  }
};

// Submit popup form
export const submitPopupForm = async (req, res) => {
  try {
    const { itemId } = req.params;
    let { data } = req.body;
    const userId = req.user.id; // From auth middleware
    const assignmentId = req.body.assignmentId || null;

    // Parse data if stringified
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    // Validate user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate form
    const form = await PopupForm.findById(itemId);
    if (!form || form.status !== 'Active') {
      return res.status(404).json({
        success: false,
        message: 'Form not found or inactive'
      });
    }

    // Validate assignment
    const assignment = await Assignment.findOne({
      userId,
      itemId,
      type: 'popup_form',
      status: { $in: ['assigned', 'pending'] }
    });
    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this form'
      });
    }

    // Use the assignmentId from the found assignment
    const validatedAssignmentId = assignment._id;

    // Handle file uploads
    const fieldMap = new Map(form.fields.map(field => [field.name, field]));
    const validatedData = await Promise.all(data.map(async field => {
      const fieldDef = fieldMap.get(field.fieldName);
      if (!fieldDef) {
        throw new Error(`Field ${field.fieldName} not found in form definition`);
      }
      if (fieldDef.required && (field.value === null || field.value === '')) {
        throw new Error(`Field ${field.fieldName} is required`);
      }
      if (fieldDef.validation?.pattern) {
        const regex = new RegExp(fieldDef.validation.pattern);
        if (!regex.test(field.value)) {
          throw new Error(`Field ${field.fieldName} does not match required pattern`);
        }
      }
      if (fieldDef.type === 'number' && isNaN(field.value)) {
        throw new Error(`Field ${field.fieldName} must be a number`);
      }
      if (fieldDef.type === 'email' && !/^\S+@\S+\.\S+$/.test(field.value)) {
        throw new Error(`Field ${field.fieldName} must be a valid email`);
      }
      if (fieldDef.type === 'file' && req.files && req.files[`files[${field.fieldName}]`]) {
        const file = req.files[`files[${field.fieldName}]`];
        const uploadDir = path.join(__dirname, '../Uploads');
        const fileName = `${Date.now()}_${file.name}`;
        const uploadPath = path.join(uploadDir, fileName);
    
        await fs.mkdir(uploadDir, { recursive: true });
        await file.mv(uploadPath);
    
        field.value = `/Uploads/${fileName}`;
      }
      return {
        fieldName: field.fieldName,
        value: field.value,
        submittedAt: new Date()
      };
    }));
    

    // Create submission
    const submission = new FormSubmission({
      userId,
      formId: itemId,
      assignmentId: validatedAssignmentId,
      data: validatedData,
      status: 'submitted',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    await submission.save();

    // Update assignment status
    await Assignment.findByIdAndUpdate(validatedAssignmentId, { status: 'completed' });

    // Add notification to user if inApp notifications are enabled
    if (user.notificationPreferences.inApp) {
      await User.findByIdAndUpdate(userId, {
        $push: {
          notifications: {
            id: require('uuid').v4(),
            type: 'form',
            title: `Form Submission: ${form.title}`,
            content: `Your submission for "${form.title}" has been received.`,
            metadata: { formId: itemId, submissionId: submission._id }
          }
        }
      });

      // Send WebSocket notification
      sendNotification(userId, {
        type: 'form_submission',
        title: `Form Submission: ${form.title}`,
        content: `Your submission for "${form.title}" has been received.`,
        metadata: { formId: itemId, submissionId: submission._id }
      });
    }

    res.status(201).json({
      success: true,
      submission,
      message: 'Form submitted successfully'
    });
  } catch (err) {
    console.error('Error submitting form:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error submitting form'
    });
  }
};

// Get user's form submissions
export const getUserFormSubmissions = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { formId, assignmentId } = req.query;

    const query = { userId };
    if (formId) query.formId = formId;
    if (assignmentId) query.assignmentId = assignmentId;

    const submissions = await FormSubmission.find(query)
      .populate('formId', 'title fields')
      .populate('assignmentId', 'title status dueDate')
      .sort({ submittedAt: -1 });

    // Validate submitted data against form fields
    for (let submission of submissions) {
      if (submission.formId && submission.formId.fields) {
        const fieldMap = new Map(submission.formId.fields.map(field => [field.name, field]));
        submission.data = submission.data.map(submittedField => {
          const fieldDef = fieldMap.get(submittedField.fieldName);
          if (!fieldDef) {
            return { ...submittedField, error: 'Field not found in form definition' };
          }
          if (fieldDef.required && (submittedField.value === null || submittedField.value === '')) {
            return { ...submittedField, error: 'Required field is empty' };
          }
          if (fieldDef.validation?.pattern) {
            const regex = new RegExp(fieldDef.validation.pattern);
            if (!regex.test(submittedField.value)) {
              return { ...submittedField, error: 'Value does not match required pattern' };
            }
          }
          return submittedField;
        });
      }
    }

    res.json({
      success: true,
      submissions
    });
  } catch (err) {
    console.error('Error fetching form submissions:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching form submissions'
    });
  }
};

// Invoice payment endpoint (placeholder)
export const payPopupInvoice = async (req, res) => {
  try {
    const { itemId } = req.params;
    // Implement payment processing logic here
    res.json({ 
      success: true,
      message: 'Payment processed successfully'
    });
  } catch (err) {
    console.error('Error processing payment:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error processing payment' 
    });
  }
};

// Message acknowledgement endpoint (placeholder)
export const acknowledgePopupMessage = async (req, res) => {
  try {
    const { itemId } = req.params;
    // Implement message acknowledgement logic here
    res.json({ 
      success: true,
      message: 'Message acknowledged successfully'
    });
  } catch (err) {
    console.error('Error acknowledging message:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error acknowledging message' 
    });
  }
};