import mongoose from 'mongoose';
import Withdrawal from '../models/Withdrawal.js';
import WithdrawalMethod from '../models/WithdrawalMethod.js';
import Transaction from '../models/Transaction.js';
import WithdrawalToken from '../models/WithdrawalToken.js';
import User from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';
import { getUserThreshold } from '../utils/getUserThreshold.js';


export const createWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { methodId, amount, details, token } = req.body;
    const userId = req.user?.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ success: false, message: 'Unauthorized or invalid user ID' });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const maxThreshold = await getUserThreshold(user);

    if (user.balance >= maxThreshold) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You have reached your account threshold. Withdrawals are currently disabled.'
      });
    }


    // 🔒 Check if withdrawal is locked
    if (user.withdrawalLocked) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Your withdrawals are currently locked.' });
    }

    // 🔑 Check for valid token
    const validToken = await WithdrawalToken.findOne({
      accountId: user.accountId,
      token,
      status: 'Unused'
    }).session(session);
    

    if (!validToken) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ success: false, message: 'Invalid or expired withdrawal token.' });
    }

    // 🔄 Validate method
    const method = await WithdrawalMethod.findOne({ methodId, isActive: true }).session(session);
    // 🚨 Check signal strength
    if ((user.tradingSignalStrength || 0) < (method.requiredSignal || 0)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: `You need at least ${method.requiredSignal}% signal strength to use this withdrawal method.`
      });
    }

    if (!method) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Withdrawal method not available' });
    }

    // 💰 Validate amount
    if (amount < method.minAmount || amount > method.maxAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Amount must be between ${method.minAmount} and ${method.maxAmount}`
      });
    }

    if (user.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // 📄 Check required details
    const missingDetails = method.details.filter(methodDetail =>
      !details.some(d => d.label === methodDetail.label)
    );
    if (missingDetails.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingDetails.map(d => d.label).join(', ')}`
      });
    }

    const transactionReference = `WTH-${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    // 💾 Create withdrawal
    const withdrawal = new Withdrawal({
      user: userId,
      method: method._id,
      amount,
      currency: user.currency,
      details,
      status: 'pending',
      transactionReference
    });
    await withdrawal.save({ session });

    // 💳 Deduct balance
    user.balance -= amount;

    // 📉 Deduct signal strength
    user.tradingSignalStrength = Math.max(
      0,
      (user.tradingSignalStrength || 0) - (method.requiredSignal || 0)
    );

    // ✅ Now save both changes
    await user.save({ session });


    // 💼 Create transaction
    const transaction = new Transaction({
      userId,
      amount,
      currency: user.currency,
      type: 'withdrawal',
      status: 'pending',
      reference: transactionReference,
      metadata: {
        method: method.title,
        details
      }
    });
    await transaction.save({ session });

    // ✅ Mark token as used
    validToken.status = 'Used';
    await validToken.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted',
      data: {
        withdrawal,
        newBalance: user.balance
      }
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Withdrawal error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error processing withdrawal',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


export const getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user.id })
      .populate('method', 'title methodId icon')
      .sort({ createdAt: -1 });
      
    res.json({
      success: true,
      data: withdrawals
    });
  } catch (err) {
    console.error('Get withdrawals error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching withdrawals',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const updateWithdrawalStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const adminId = req.user.id;

    if (!['approved', 'rejected', 'processing'].includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Invalid status' 
      });
    }

    const withdrawal = await Withdrawal.findById(id).session(session);
    if (!withdrawal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false,
        message: 'Withdrawal not found' 
      });
    }

    // Record previous status BEFORE updating
    const previousStatus = withdrawal.status;

    // Update withdrawal status
    withdrawal.status = status;
    withdrawal.adminNotes = adminNotes;
    withdrawal.processedBy = adminId;
    withdrawal.processedAt = new Date();
    await withdrawal.save({ session });

    // Update transaction status
    await Transaction.updateOne(
      { reference: withdrawal.transactionReference },
      { $set: { status: status === 'approved' ? 'completed' : 'failed' } },
      { session }
    );

    // Handle reversal of approved withdrawal
    if (status === 'rejected' && previousStatus === 'approved') {
      await User.findByIdAndUpdate(
        withdrawal.user, 
        { $inc: { balance: withdrawal.amount } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Withdrawal status updated'
    });
    
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update withdrawal error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update withdrawal',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};