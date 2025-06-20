import mongoose from 'mongoose';
import Withdrawal from '../models/Withdrawal.js';
import WithdrawalMethod from '../models/WithdrawalMethod.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';

export const createWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.user || !req.user.id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Invalid user ID format' 
      });
    }

    const { methodId, amount, details, token } = req.body;
    const userId = req.user.id;

    const method = await WithdrawalMethod.findOne({ 
      methodId,
      isActive: true 
    }).session(session);
    
    if (!method) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Withdrawal method not available' 
      });
    }

    if (amount < method.minAmount || amount > method.maxAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: `Amount must be between ${method.minAmount} and ${method.maxAmount}`
      });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (user.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Insufficient balance' 
      });
    }

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

    // Generate unique transaction reference
    const transactionReference = `WTH-${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    // Create withdrawal record
    const withdrawal = new Withdrawal({
      user: userId,
      method: method._id,
      amount,
      details,
      status: 'pending',
      transactionReference
    });

    await withdrawal.save({ session });

    // Update user balance
    user.balance -= amount;
    await user.save({ session });

    // Create transaction record
    const transaction = new Transaction({
      userId,
      amount,
      currency: user.currency || 'NGN',
      type: 'withdrawal',
      status: 'pending',
      reference: transactionReference,
      metadata: {
        method: method.title,
        details
      }
    });

    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
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
    res.status(500).json({ 
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