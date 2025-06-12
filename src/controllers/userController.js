import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { validateUserInput } from '../utils/validation.js';
import { validatePassword } from '../utils/passwordValidation.js';
import { processReferral } from './referralController.js';
import { createNotification } from './notificationController.js'; // Add this import
import Assignment from '../models/Assignment.js';
import FormSubmission from '../models/FormSubmission.js';
import PopupForm from '../models/PopupForm.js';
import PopupInvoice from '../models/PopupInvoice.js';
import PopupMessage from '../models/PopupMessage.js';
import Deposit from '../models/Deposit.js';
import PaymentMethod from '../models/PaymentMethod.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { user: { id: user._id } },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

export const signup = async (req, res) => {
  const { email, password, referralCode } = req.body;

  // Validate input
  const validation = validateUserInput(email, password);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({ email, password });
    await user.save();

    // Process referral if code was provided
    if (referralCode) {
      try {
        await processReferral(referralCode, user._id);
        
        // Create welcome notification for referral signup
        await createNotification(user._id, {
          type: 'promo',
          title: 'Welcome Bonus!',
          content: `You joined using a referral code. You'll earn special benefits!`,
          metadata: { isReferral: true },
          isRead: false
        });
      } catch (referralError) {
        console.error('Referral processing error:', referralError);
      }
    }

    // Always send a welcome notification (in addition to referral notification if applicable)
    await createNotification(user._id, {
      type: 'welcome',
      title: 'Welcome to Our Platform!',
      content: 'Thank you for creating an account with us. Get started by exploring our features!',
      metadata: { isWelcome: true },
      isRead: false
    });

    // Generate token
    const token = generateToken(user);
    res.status(201).json({ 
      token, 
      accountId: user.accountId,
      referralCode: user.referral.code
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -otp -__v')
      .populate('referral.referredBy', 'firstName lastName accountId');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      accountId: user.accountId,
      faceImage: user.verification.faceImage,
      verification: user.verification,
      referral: {
        code: user.referral.code,
        referredBy: user.referral.referredBy,
        totalReferrals: user.referral.totalReferrals,
        totalEarned: user.referral.totalEarned,
        pendingBonus: user.referral.pendingBonus
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password +lastLogin');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    const isFirstLogin = !user.lastLogin;
    const token = generateToken(user);

    // Update lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();

    // Only send first login notification if it's truly the first login
    if (isFirstLogin) {
      await createNotification(user._id, {
        type: 'system',
        title: 'Welcome to Our Platform!',
        content: 'Congratulations on your first login! Here are some tips to get started...',
        metadata: { isFirstLogin: true },
        isRead: false
      });
    } else {
      // Send different notification for returning users
      await createNotification(user._id, {
        type: 'system',
        title: 'Welcome Back!',
        content: `Good to see you again! Last login: ${user.lastLogin.toLocaleString()}`,
        metadata: { isReturning: true },
        isRead: false
      });
    }

    res.json({ 
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        accountId: user.accountId,
        referralCode: user.referral.code,
        referralStats: {
          totalReferrals: user.referral.totalReferrals,
          totalEarned: user.referral.totalEarned,
          pendingBonus: user.referral.pendingBonus
        }
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Basic validation
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Both old and new passwords are required' 
      });
    }

    // Get user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Verify old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Current password is incorrect' 
      });
    }

    // Validate new password meets model requirements
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if new password is different
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ 
      success: true,
      message: 'Password updated successfully'
    });

  } catch (err) {
    console.error('Password change error:', err.message);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Server error during password change' 
    });
  }
};

// Additional referral-related methods
export const getReferralDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('referral firstName lastName')
      .populate('referral.referrals.userId', 'firstName lastName email accountId joinedDate');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      referralCode: user.referral.code,
      referredBy: user.referral.referredBy,
      totalReferrals: user.referral.totalReferrals,
      totalEarned: user.referral.totalEarned,
      pendingBonus: user.referral.pendingBonus,
      referrals: user.referral.referrals.map(ref => ({
        user: ref.userId,
        joinedDate: ref.joinedDate,
        bonusEarned: ref.bonusEarned
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitPopupForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const { assignmentId, data } = req.body;
    const userId = req.user._id;

    const form = await PopupForm.findById(formId);
    const assignment = await Assignment.findById(assignmentId);

    if (!form || !assignment || assignment.userId.toString() !== userId.toString()) {
      return res.status(404).json({ success: false, message: 'Form or assignment not found' });
    }

    const existingSubmission = await FormSubmission.findOne({ userId, formId, assignmentId });
    if (existingSubmission) {
      return res.status(400).json({ success: false, message: 'Form already submitted' });
    }

    // Validate form data
    const submissionData = [];
    for (const field of form.fields) {
      const value = data[field.name];
      let error = null;

      if (field.required && (!value || value.toString().trim() === '')) {
        error = 'This field is required';
      } else if (field.validation?.pattern && value && !new RegExp(field.validation.pattern).test(value)) {
        error = 'Invalid format';
      } else if (field.type === 'email' && value && !/^\S+@\S+\.\S+$/.test(value)) {
        error = 'Invalid email';
      } else if (field.type === 'number' && value && isNaN(value)) {
        error = 'Must be a number';
      }

      submissionData.push({ fieldName: field.name, value, error });
    }

    if (submissionData.some(d => d.error)) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: submissionData });
    }

    // Handle file uploads
    const files = req.files || {};
    for (const field of form.fields.filter(f => f.type === 'file')) {
      if (files[field.name]) {
        const file = files[field.name];
        const uploadDir = path.join(__dirname, '../uploads/form-files');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const fileName = `form-${Date.now()}${path.extname(file.name)}`;
        const filePath = path.join(uploadDir, fileName);
        await file.mv(filePath);
        submissionData.find(d => d.fieldName === field.name).value = `/form-files/${fileName}`;
      }
    }

    const submission = new FormSubmission({
      userId,
      formId,
      assignmentId,
      data: submissionData,
      status: 'submitted',
    });

    await submission.save();
    await Assignment.findByIdAndUpdate(assignmentId, { status: 'completed' });

    res.json({ success: true, message: 'Form submitted successfully', submission });
  } catch (err) {
    console.error('SubmitPopupForm error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const payPopupInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { assignmentId, paymentMethodId, amount, currency } = req.body;
    const userId = req.user._id;

    const invoice = await PopupInvoice.findById(invoiceId);
    const assignment = await Assignment.findById(assignmentId);
    const paymentMethod = await PaymentMethod.findOne({ methodId: paymentMethodId, isActive: true });

    if (!invoice || !assignment || !paymentMethod || assignment.userId.toString() !== userId.toString()) {
      return res.status(404).json({ success: false, message: 'Invoice, assignment, or payment method not found' });
    }

    if (invoice.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Invoice already paid' });
    }

    if (amount !== invoice.amount || currency !== invoice.currency) {
      return res.status(400).json({ success: false, message: 'Invalid amount or currency' });
    }

    if (!req.files || !req.files.paymentProof) {
      return res.status(400).json({ success: false, message: 'Payment proof required' });
    }

    const paymentProof = req.files.paymentProof;
    const uploadDir = path.join(__dirname, '../Uploads/payment-proofs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fileName = `proof-${Date.now()}${path.extname(paymentProof.name)}`;
    const filePath = path.join(uploadDir, fileName);
    await paymentProof.mv(filePath);

    const deposit = new Deposit({
      userId,
      paymentMethodId,
      amount,
      currency,
      paymentProof: `/payment-proofs/${fileName}`,
      transactionReference: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      metadata: {
        invoiceId,
        assignmentId,
        paymentMethodDetails: paymentMethod.details,
      },
    });

    await deposit.save();
    await PopupInvoice.findByIdAndUpdate(invoiceId, { paymentStatus: 'pending' });
    await Assignment.findByIdAndUpdate(assignmentId, { status: 'pending_payment' });

    res.json({ success: true, message: 'Payment submitted successfully', deposit });
  } catch (err) {
    console.error('PayPopupInvoice error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const acknowledgePopupMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { assignmentId } = req.body;
    const userId = req.user._id;

    const message = await PopupMessage.findById(messageId);
    const assignment = await Assignment.findById(assignmentId);

    if (!message || !assignment || assignment.userId.toString() !== userId.toString()) {
      return res.status(404).json({ success: false, message: 'Message or assignment not found' });
    }

    if (message.acknowledged) {
      return res.status(400).json({ success: false, message: 'Message already acknowledged' });
    }

    await PopupMessage.findByIdAndUpdate(messageId, { acknowledged: true });
    await Assignment.findByIdAndUpdate(assignmentId, { status: 'acknowledged' });

    res.json({ success: true, message: 'Message acknowledged successfully' });
  } catch (err) {
    console.error('AcknowledgePopupMessage error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getUserAssignments = async (req, res) => {
  try {
    const userId = req.user._id;
    const assignments = await Assignment.find({ userId })
      .populate('itemId')
      .sort({ priority: -1, createdAt: -1 });

    res.json({ success: true, assignments });
  } catch (err) {
    console.error('GetUserAssignments error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};