import User from '../models/User.js';
import Setting from '../models/Setting.js';
import Currency from '../models/Currency.js';
import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';


const getDefaultCurrency = async () => {
  const setting = await Setting.findOne().lean();
  return setting?.defaultCurrency || 'USD';
};

const convertAmount = (amount, fromRate, toRate) => {
  if (fromRate === 0) return amount;
  return parseFloat(((amount / fromRate) * toRate).toFixed(2));
};
// Get user's referral information
export const getReferralInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('referral currency firstName lastName')
      .populate('referral.referredBy', 'firstName lastName accountId')
      .populate('referral.referrals.userId', 'firstName lastName email accountId joinedDate');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const defaultCurrencyCode = await getDefaultCurrency();
    const [defaultCurrency, userCurrency] = await Promise.all([
      Currency.findOne({ code: defaultCurrencyCode }).lean(),
      Currency.findOne({ code: user.currency }).lean()
    ]);

    if (!defaultCurrency || !userCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Currency configuration error.'
      });
    }

    const totalEarnedConverted = convertAmount(
      user.referral.totalEarned,
      defaultCurrency.rate,
      userCurrency.rate
    );

    const pendingBonusConverted = convertAmount(
      user.referral.pendingBonus,
      defaultCurrency.rate,
      userCurrency.rate
    );

    const referralsWithConvertedBonus = user.referral.referrals.map(ref => ({
      user: ref.userId,
      joinedDate: ref.joinedDate,
      bonusEarned: convertAmount(ref.bonusEarned, defaultCurrency.rate, userCurrency.rate)
    }));

    res.json({
      success: true,
      referralCode: user.referral.code,
      referredBy: user.referral.referredBy,
      totalReferrals: user.referral.totalReferrals,
      totalEarned: totalEarnedConverted,
      pendingBonus: pendingBonusConverted,
      referrals: referralsWithConvertedBonus,
      currency: userCurrency.code
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Get referral statistics
export const getReferralStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('referral.totalReferrals referral.totalEarned referral.pendingBonus currency');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const defaultCurrencyCode = await getDefaultCurrency();
    const [defaultCurrency, userCurrency] = await Promise.all([
      Currency.findOne({ code: defaultCurrencyCode }).lean(),
      Currency.findOne({ code: user.currency }).lean()
    ]);

    if (!defaultCurrency || !userCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Currency configuration error.'
      });
    }

    const totalEarned = convertAmount(user.referral.totalEarned, defaultCurrency.rate, userCurrency.rate);
    const pendingBonus = convertAmount(user.referral.pendingBonus, defaultCurrency.rate, userCurrency.rate);

    res.json({
      success: true,
      totalReferrals: user.referral.totalReferrals,
      totalEarned,
      pendingBonus,
      currency: userCurrency.code
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Get list of referred users
export const getReferredUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('referral.referrals currency')
      .populate('referral.referrals.userId', 'firstName lastName email accountId joinedDate');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const defaultCurrencyCode = await getDefaultCurrency();
    const [defaultCurrency, userCurrency] = await Promise.all([
      Currency.findOne({ code: defaultCurrencyCode }).lean(),
      Currency.findOne({ code: user.currency }).lean()
    ]);

    if (!defaultCurrency || !userCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Currency configuration error.'
      });
    }

    const referrals = user.referral.referrals.map(ref => ({
      user: ref.userId,
      joinedDate: ref.joinedDate,
      bonusEarned: convertAmount(ref.bonusEarned, defaultCurrency.rate, userCurrency.rate)
    }));

    res.json({ success: true, referrals, currency: userCurrency.code });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Process a referral signup
export const processReferral = async (referrerCode, newUserId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Find the referrer by code
    const referrer = await User.findOne({ 'referral.code': referrerCode }).session(session);
    if (!referrer) {
      throw new Error('Invalid referral code');
    }

    // Find the newly registered user
    const newUser = await User.findById(newUserId).session(session);
    if (!newUser) {
      throw new Error('New user not found');
    }

    // Update the referrer’s referral list
    referrer.referral.referrals.push({
      userId: newUser._id,
      bonusEarned: 0
    });
    referrer.referral.totalReferrals += 1;

    // Link the new user to the referrer
    newUser.referral.referredBy = referrer._id;

    // 🟡 Fetch referral bonus amount from global settings
    const settings = await Setting.findOne().session(session);
    const referralBonus = settings?.referralCommission || 0.1;

    if (referralBonus > 0) {
      // Fetch currencies
      const defaultCurrency = await Currency.findOne({ code: settings.defaultCurrency }).session(session);
      const userCurrency = await Currency.findOne({ code: referrer.currency }).session(session);
    
      if (!defaultCurrency || !userCurrency) throw new Error('Currency error');
    
      const convertedBonus = parseFloat(((referralBonus / defaultCurrency.rate) * userCurrency.rate).toFixed(2));
    
      // Add to balance immediately
      referrer.balance += convertedBonus;
      referrer.referral.totalEarned += referralBonus;
    
      // Set earned bonus for referred user
      const referralEntry = referrer.referral.referrals.find(ref => ref.userId.toString() === newUser._id.toString());
      if (referralEntry) {
        referralEntry.bonusEarned = referralBonus;
      }
    
      // Record the transaction
      await new Transaction({
        userId: referrer._id,
        amount: convertedBonus,
        currency: userCurrency.code,
        type: 'referral_bonus',
        status: 'completed',
        reference: `REF-${Date.now()}`,
        metadata: {
          originalAmount: referralBonus,
          originalCurrency: defaultCurrency.code,
          convertedFrom: `${referralBonus} ${defaultCurrency.code}`,
          note: 'Referral bonus credited instantly'
        }
      }).save({ session });
      
    }
    

    // Save both documents
    await referrer.save({ session });
    await newUser.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { success: true, referrerId: referrer._id, bonusAwarded: referralBonus };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};


// Award referral bonus
export const awardReferralBonus = async (referrerId, defaultBonusAmount) => {
  try {
    const user = await User.findById(referrerId);
    if (!user) throw new Error('Referrer not found');

    const settings = await Setting.findOne().lean();
    const defaultCurrencyCode = settings?.defaultCurrency || 'USD';

    const [defaultCurrency, userCurrency] = await Promise.all([
      Currency.findOne({ code: defaultCurrencyCode }).lean(),
      Currency.findOne({ code: user.currency }).lean()
    ]);

    if (!defaultCurrency || !userCurrency) {
      throw new Error('Currency setup missing');
    }

    // 🔁 Convert default bonus to user currency
    const convertedBonus = parseFloat(((defaultBonusAmount / defaultCurrency.rate) * userCurrency.rate).toFixed(2));

    // 💰 Credit user's balance and update referral earnings
    user.balance += convertedBonus;
    user.referral.totalEarned = (user.referral.totalEarned || 0) + defaultBonusAmount;

    await user.save();

    // 🧾 Record transaction
    await Transaction.create({
      userId: user._id,
      amount: convertedBonus,
      currency: userCurrency.code,
      type: 'referral_bonus',
      status: 'completed',
      reference: `REF-${Date.now()}`,
      metadata: {
        originalAmount: defaultBonusAmount,
        originalCurrency: defaultCurrency.code,
        convertedFrom: `${defaultBonusAmount} ${defaultCurrency.code}`,
        note: 'Referral bonus credited'
      }
    });

    return { success: true };
  } catch (err) {
    console.error('Referral bonus error:', err.message);
    return { success: false, message: err.message };
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