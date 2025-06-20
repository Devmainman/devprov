import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';


export const getBalance = async (req, res) => {
  try {
    // Convert req.user.id to ObjectId
    const userId = new mongoose.Types.ObjectId(req.user.id);
    
    const user = await User.findById(userId)
      .select('accountId currency verification balance')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Debug log to verify balance
    console.log(`[DEBUG] User ${userId} balance: ${user.balance}`);
    
    res.json({
      success: true,
      data: {
        balance: user.balance,
        currency: user.currency || 'NGN',
        accountId: user.accountId,
        verificationStatus: user.verification
      }
    });

  } catch (err) {
    console.error('Balance fetch error:', {
      message: err.message,
      userId: req.user.id,
      stack: err.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch balance',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;

    // Convert to ObjectId
    const userId = new mongoose.Types.ObjectId(req.user.id);
    
    const query = { userId };
    
    if (search) {
      query.$or = [
        { bankName: new RegExp(search, 'i') },
        { accountName: new RegExp(search, 'i') },
        { reference: new RegExp(search, 'i') },
        { type: new RegExp(search, 'i') }
      ];
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query)
    ]);

    // Convert ObjectIds to strings
    const formattedTransactions = transactions.map(t => ({
      ...t,
      id: t._id.toString(),
      userId: t.userId.toString(),
      createdAt: t.createdAt.toISOString()
    }));

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });

  } catch (err) {
    console.error('Transactions fetch error:', {
      error: err.message,
      userId: req.user.id,
      query: req.query
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
};

export const createDeposit = async (req, res) => {
  try {
    const { amount, bankName, accountNumber, reference } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid deposit amount is required'
      });
    }

    // Create deposit transaction
    const deposit = new Transaction({
      userId: new mongoose.Types.ObjectId(userId),
      amount,
      type: 'deposit',
      status: 'completed',
      bankName,
      accountNumber,
      reference: reference || `DEP-${Date.now()}`,
      currency: 'NGN'
    });

    await deposit.save();

    // Update user's balance field
    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      { $inc: { balance: amount } },
      { new: true } // Return updated document
    ).select('balance');

    res.status(201).json({
      success: true,
      message: 'Deposit successful',
      data: {
        newBalance: updatedUser.balance,
        reference: deposit.reference
      }
    });
  } catch (err) {
    console.error('Deposit error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to process deposit',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};