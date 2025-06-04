import User from '../models/User.js';
import mongoose from 'mongoose';

// Get user's referral information
export const getReferralInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('referral firstName lastName')
      .populate('referral.referredBy', 'firstName lastName accountId')
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
      referrals: user.referral.referrals
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get referral statistics
export const getReferralStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('referral.totalReferrals referral.totalEarned referral.pendingBonus');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      totalReferrals: user.referral.totalReferrals,
      totalEarned: user.referral.totalEarned,
      pendingBonus: user.referral.pendingBonus
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get list of referred users
export const getReferredUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('referral.referrals')
      .populate('referral.referrals.userId', 'firstName lastName email accountId joinedDate');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
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

// Process a referral signup
export const processReferral = async (referrerCode, newUserId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Find the referrer
    const referrer = await User.findOne({ 'referral.code': referrerCode }).session(session);
    if (!referrer) {
      throw new Error('Invalid referral code');
    }

    // Find the new user
    const newUser = await User.findById(newUserId).session(session);
    if (!newUser) {
      throw new Error('New user not found');
    }

    // Update both users
    referrer.referral.referrals.push({
      userId: newUser._id,
      bonusEarned: 0
    });
    referrer.referral.totalReferrals += 1;
    
    newUser.referral.referredBy = referrer._id;

    await referrer.save({ session });
    await newUser.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    return { success: true, referrerId: referrer._id };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// Award referral bonus
export const awardReferralBonus = async (userId, amount) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const user = await User.findById(userId).session(session);
    if (!user || !user.referral.referredBy) {
      throw new Error('User or referrer not found');
    }

    const referrer = await User.findById(user.referral.referredBy).session(session);
    if (!referrer) {
      throw new Error('Referrer not found');
    }

    // Calculate bonus (10% of amount by default, or custom rate)
    const bonusAmount = amount * (referrer.referral.referralBonusRate || 0.1);
    
    // Update referrer's stats
    referrer.referral.pendingBonus += bonusAmount;
    referrer.referral.totalEarned += bonusAmount;
    
    // Update the specific referral record
    const referralRecord = referrer.referral.referrals.find(
      ref => ref.userId.toString() === userId.toString()
    );
    
    if (referralRecord) {
      referralRecord.bonusEarned += bonusAmount;
    }

    await referrer.save({ session });
    await session.commitTransaction();
    session.endSession();

    return { success: true, bonusAmount };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// Withdraw referral bonus
export const withdrawReferralBonus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.referral.pendingBonus <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No pending bonus to withdraw' 
      });
    }

    const amount = user.referral.pendingBonus;
    
    // Add to wallet balance
    user.walletBalance += amount;
    user.referral.pendingBonus = 0;
    
    await user.save();

    res.json({
      success: true,
      message: `$${amount.toFixed(2)} referral bonus transferred to wallet`,
      newBalance: user.walletBalance,
      pendingBonus: 0
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};