// controllers/assignmentController.js
import Assignment from '../models/Assignment.js';
import User from '../models/User.js';
import PopupForm from '../models/PopupForm.js';
import PopupInvoice from '../models/PopupInvoice.js';
import PopupMessage from '../models/PopupMessage.js';
import nodemailer from 'nodemailer';
import Setting from '../models/Setting.js';

const sendEmailNotification = async (user, message) => {
  try {
    const settings = await Setting.findOne();
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpEncryption === 'ssl',
      auth: {
        user: settings.smtpUsername,
        pass: settings.smtpPassword,
      },
    });
    await transporter.sendMail({
      from: `${settings.smtpMailFromName} <${settings.smtpMailFromAddress}>`,
      to: user.email,
      subject: message.title,
      html: `<p>${message.description}</p>${message.filePath ? `<p><a href="${message.filePath}">View Attachment</a></p>` : ''}`,
    });
  } catch (err) {
    console.error('Email notification error:', err);
  }
};

export const assignPopupForm = async (req, res) => {
  try {
    const { userId, formId } = req.params;
    const user = await User.findById(userId);
    const form = await PopupForm.findById(formId);
    if (!user || !form) {
      return res.status(404).json({ success: false, message: 'User or form not found' });
    }
    const existingAssignment = await Assignment.findOne({
      userId,
      referenceId: formId,
      type: 'popup_form',
    });
    if (existingAssignment) {
      return res.status(400).json({ success: false, message: 'Form already assigned to this user' });
    }
    console.log('AssignPopupForm - req.user:', req.user);
    const assignment = new Assignment({
      userId,
      adminId: req.user.id,
      type: 'popup_form',
      itemId: formId,
      referenceId: formId, // Set referenceId to formId
      title: form.title,
      status: 'assigned',
      blockProgress: true,
      metadata: {
        description: form.description,
        fieldsCount: form.fields.length,
      },
    });
    console.log('Creating assignment:', {
      userId: userId.toString(),
      adminId: req.user.id.toString(),
      formId: formId.toString(),
    });
    await assignment.save();
    res.json({ success: true, message: 'Form assigned successfully', assignment });
  } catch (err) {
    console.error('AssignPopupForm error:', err);
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Form already assigned to this user' });
    } else {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
};

export const assignPopupInvoice = async (req, res) => {
  try {
    const { userId, invoiceId } = req.params;
    console.log('Reached assignPopupInvoice:', req.params);
    console.log('AssignPopupInvoice - req.user:', req.user);
    const user = await User.findById(userId);
    const invoice = await PopupInvoice.findById(invoiceId);
    if (!user || !invoice) {
      return res.status(404).json({ success: false, message: 'User or invoice not found' });
    }
    const existingAssignment = await Assignment.findOne({
      userId,
      referenceId: invoiceId,
      type: 'popup_invoice',
    });
    if (existingAssignment) {
      return res.status(400).json({ success: false, message: 'Invoice already assigned to this user' });
    }
    const assignment = new Assignment({
      userId,
      adminId: req.user.id,
      type: 'popup_invoice',
      itemId: invoiceId,
      referenceId: invoiceId, // Set referenceId to invoiceId
      title: invoice.title,
      status: 'pending_payment',
      blockProgress: true,
      metadata: {
        amount: invoice.amount,
        currency: invoice.currency,
        description: invoice.description,
      },
    });
    await assignment.save();
    res.json({ success: true, message: 'Invoice assigned successfully', assignment });
  } catch (err) {
    console.error('AssignPopupInvoice error:', err);
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Invoice already assigned to this user' });
    } else {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
};

export const assignPopupMessage = async (req, res) => {
  try {
    const { userId, messageId } = req.params;
    const user = await User.findById(userId);
    const message = await PopupMessage.findById(messageId);
    if (!user || !message) {
      return res.status(404).json({ success: false, message: 'User or message not found' });
    }
    const existingAssignment = await Assignment.findOne({
      userId,
      referenceId: messageId,
      type: 'popup_message',
    });
    if (existingAssignment) {
      return res.status(400).json({ success: false, message: 'Message already assigned to this user' });
    }
    console.log('AssignPopupMessage - req.user:', req.user);
    const assignment = new Assignment({
      userId,
      adminId: req.user.id,
      type: 'popup_message',
      itemId: messageId,
      referenceId: messageId, // Set referenceId to messageId
      title: message.title,
      status: 'assigned',
      blockProgress: false,
      metadata: {
        description: message.description,
        filePath: message.filePath,
      },
    });
    await assignment.save();
    if (['email', 'both'].includes(message.notificationType)) {
      await sendEmailNotification(user, message);
    }
    res.json({ success: true, message: 'Message assigned successfully', assignment });
  } catch (err) {
    console.error('AssignPopupMessage error:', err);
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Message already assigned to this user' });
    } else {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
};

export const getUserAssignments = async (req, res) => {
  try {
    const { userId } = req.params;
    const assignments = await Assignment.find({ userId })
      .populate('itemId')
      .sort({ createdAt: -1 });
    res.json({ success: true, assignments });
  } catch (err) {
    console.error('GetUserAssignments error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateAssignmentStatus = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { status } = req.body;
    const assignment = await Assignment.findByIdAndUpdate(
      assignmentId,
      { status },
      { new: true }
    );
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    res.json({ success: true, message: 'Assignment status updated', assignment });
  } catch (err) {
    console.error('UpdateAssignmentStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// New GET functions for fetching active popup items
export const getPopupForms = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : { status: 'Active' };
    const forms = await PopupForm.find(query).sort({ createdAt: -1 });
    res.json({ success: true, forms });
  } catch (err) {
    console.error('GetPopupForms error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getPopupInvoices = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : { status: 'Active' };
    const invoices = await PopupInvoice.find(query).sort({ createdAt: -1 });
    res.json({ success: true, invoices });
  } catch (err) {
    console.error('GetPopupInvoices error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getPopupMessages = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : { status: 'Active' };
    const messages = await PopupMessage.find(query).sort({ createdAt: -1 });
    res.json({ success: true, messages });
  } catch (err) {
    console.error('GetPopupMessages error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};