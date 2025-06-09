import mongoose from 'mongoose'; // Add this import
import Withdrawal from '../models/Withdrawal.js';
import WithdrawalMethod from '../models/WithdrawalMethod.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

export const createWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('req.user:', req.user);

    if (!req.user || !req.user.id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ 
        message: 'User not authenticated' 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        message: 'Invalid user ID format' 
      });
    }

    const { methodId, amount, details } = req.body;
    const userId = req.user.id;

    const method = await WithdrawalMethod.findOne({ 
      methodId,
      isActive: true 
    }).session(session);
    
    if (!method) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        message: 'Withdrawal method not available' 
      });
    }

    if (amount < method.minAmount || amount > method.maxAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        message: `Amount must be between ${method.minAmount} and ${method.maxAmount}`
      });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    if (user.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
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
        message: `Missing required fields: ${missingDetails.map(d => d.label).join(', ')}`
      });
    }

    const withdrawal = new Withdrawal({
      user: userId,
      method: method._id,
      amount,
      details,
      status: 'pending'
    });

    await withdrawal.save({ session });

    user.balance -= amount;
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(withdrawal);

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Withdrawal error:', err);
    res.status(500).json({ 
      message: 'Error processing withdrawal',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user.id }) // Use req.user.id
      .populate('method', 'title methodId icon')
      .populate('user', 'accountId firstName lastName currency');
      
    res.json(withdrawals);
  } catch (err) {
    console.error('Get withdrawals error:', err);
    res.status(500).json({ 
      message: 'Error fetching withdrawals',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};