import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { validateUserInput } from '../utils/validation.js';
import { validatePassword } from '../utils/passwordValidation.js';
import { processReferral } from './referralController.js';
import { createNotification } from './notificationController.js'; // Add this import

dotenv.config();

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