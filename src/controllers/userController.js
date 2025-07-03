import mongoose from 'mongoose';
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
import Invoice from '../models/Invoice.js';
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

    console.log('User status & block reason:', user.status, user.blockReason);

    // ✅ Return full user object (the way User.findById returns it)
    res.json(user);

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
    const assignmentId = req.body.assignmentId;
    const userId = req.user.id; // Use req.user.id instead of _id

    // Remove assignmentId from form data
    const { assignmentId: _, ...formData } = req.body;

    // Convert form data to match schema
    const dataArray = Object.entries(formData).map(([fieldName, value]) => ({
      fieldName,
      value: value.toString() // Convert to string if needed
    }));

    // Process files
    const files = {};
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        files[file.fieldname] = {
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer
        };
      });
    }

    // Create submission
    const submission = new FormSubmission({
      userId: new mongoose.Types.ObjectId(userId), // Convert to ObjectId
      formId: new mongoose.Types.ObjectId(formId), // Convert to ObjectId
      assignmentId: new mongoose.Types.ObjectId(assignmentId), // Convert to ObjectId
      data: dataArray, // Array of {fieldName, value}
      status: 'submitted',
      submittedAt: new Date()
    });

    // Validate before saving
    const validationError = submission.validateSync();
    if (validationError) {
      console.error('Validation error:', validationError);
      throw validationError;
    }

    await submission.save();
    
    // Update assignment
    await Assignment.findByIdAndUpdate(assignmentId, {
      status: 'completed',
      completedAt: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Form submitted successfully'
    });

  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Server error during submission' 
    });
  }
};

export const payPopupInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { assignmentId, paymentMethodId } = req.body;
    const userId = req.user.id;

    const popupInvoice = await PopupInvoice.findById(invoiceId);
    const assignment = await Assignment.findById(assignmentId);
    const paymentMethod = await PaymentMethod.findOne({ methodId: paymentMethodId, isActive: true });
    const user = await User.findById(userId).select('accountId firstName lastName');

    // Validation checks
    if (!popupInvoice || !assignment || !paymentMethod || !user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invoice, assignment, payment method, or user not found' 
      });
    }

    if (assignment.userId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access to assignment' 
      });
    }

    if (popupInvoice.paymentStatus === 'paid') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invoice already paid' 
      });
    }

    if (!req.files?.paymentProof) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment proof required' 
      });
    }

    // Handle file upload
    const paymentProof = req.files.paymentProof;
    const uploadDir = path.join(__dirname, '../Uploads/payment-proofs');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    
    const fileName = `proof-${Date.now()}${path.extname(paymentProof.name)}`;
    const filePath = path.join(uploadDir, fileName);
    await paymentProof.mv(filePath);

    // Create new Invoice instead of Deposit
    const invoice = new Invoice({
      accountId: user.accountId,
      fullName: `${user.firstName} ${user.lastName}`,
      paymentMethod: paymentMethod.title,  // Free-text field
      paymentMethodId: paymentMethod.methodId, // Unique identifier
      amount: popupInvoice.amount,
      currency: popupInvoice.currency,
      entity: 'User',
      status: 'pending',
      paymentProof: `/payment-proofs/${fileName}`,
      userId: user._id,
      metadata: {
        originalInvoiceId: popupInvoice._id,
        assignmentId: assignment._id,
        paymentMethodId: paymentMethod._id
      }
    });

    await invoice.save();

    // Update popup invoice status
    popupInvoice.paymentStatus = 'pending';
    popupInvoice.assignmentId = assignmentId;
    await popupInvoice.save();

    // Update assignment status
    assignment.status = 'completed';
    assignment.completedAt = new Date();
    await assignment.save();

    res.json({ 
      success: true, 
      message: 'Payment submitted successfully', 
      invoiceId: invoice._id 
    });
    
  } catch (err) {
    console.error('PayPopupInvoice error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// export const acknowledgePopupMessage = async (req, res) => {
//   try {
//     const { messageId } = req.params;
//     const { assignmentId } = req.body;
//     const userId = req.user._id;

//     const message = await PopupMessage.findById(messageId);
//     const assignment = await Assignment.findById(assignmentId);

//     if (!message || !assignment || assignment.userId.toString() !== userId.toString()) {
//       return res.status(404).json({ success: false, message: 'Message or assignment not found' });
//     }

//     if (message.acknowledged) {
//       return res.status(400).json({ success: false, message: 'Message already acknowledged' });
//     }

//     await PopupMessage.findByIdAndUpdate(messageId, { acknowledged: true });
//     await Assignment.findByIdAndUpdate(assignmentId, { status: 'acknowledged' });

//     res.json({ success: true, message: 'Message acknowledged successfully' });
//   } catch (err) {
//     console.error('AcknowledgePopupMessage error:', err);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };

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