import mongoose from 'mongoose';
import User from '../models/User.js';
import Currency from '../models/Currency.js';
import Transaction from '../models/Transaction.js';

export const getBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Verify user's currency exists and is enabled
    const userCurrency = await Currency.findOne({ 
      code: user.currency, 
      status: 'Enabled' 
    });

    if (!userCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Your currency is not currently available'
      });
    }

    // Return balance in user's own currency (no conversion needed)
    res.json({
      success: true,
      data: {
        balance: user.balance,
        currency: user.currency,
        rate: 1 // 1:1 since we're using user's currency as base
      }
    });

  } catch (err) {
    console.error('Get balance error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const getSignalStrength = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('tradingSignalStrength');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, signalStrength: user.tradingSignalStrength });
  } catch (err) {
    console.error('Error fetching signal strength:', err);
    return res.status(500).json({ success: false, message: 'Failed to get signal strength' });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const user = await User.findById(userId);
    
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

    // Convert transactions to user's currency if needed
    const formattedTransactions = await Promise.all(transactions.map(async t => {
      // If transaction is already in user's currency, no conversion needed
      if (t.currency === user.currency) {
        return {
          ...t,
          id: t._id.toString(),
          userId: t.userId.toString(),
          createdAt: t.createdAt.toISOString(),
          convertedAmount: t.amount,
          displayCurrency: user.currency
        };
      }

      // Convert to user's currency if different
      const fromCurrency = await Currency.findOne({ code: t.currency });
      const toCurrency = await Currency.findOne({ code: user.currency });
      
      if (!fromCurrency || !toCurrency) {
        return {
          ...t,
          id: t._id.toString(),
          userId: t.userId.toString(),
          createdAt: t.createdAt.toISOString(),
          convertedAmount: t.amount,
          displayCurrency: t.currency,
          conversionError: true
        };
      }

      const conversionRate = toCurrency.rate / fromCurrency.rate;
      const convertedAmount = t.amount * conversionRate;

      return {
        ...t,
        id: t._id.toString(),
        userId: t.userId.toString(),
        createdAt: t.createdAt.toISOString(),
        originalAmount: t.amount,
        originalCurrency: t.currency,
        convertedAmount,
        displayCurrency: user.currency,
        conversionRate
      };
    }));

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        displayCurrency: user.currency,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });

  } catch (err) {
    console.error('Transactions fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
};

export const createDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { amount, bankName, accountNumber, reference } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'A valid deposit amount is required'
      });
    }

    // Get user with their currency
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify currency is enabled
    const currency = await Currency.findOne({
      code: user.currency,
      status: 'Enabled'
    }).session(session);

    if (!currency) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Your currency is not currently available for deposits'
      });
    }

    // Create deposit in user's currency
    const deposit = new Transaction({
      userId: user._id,
      amount,
      type: 'deposit',
      status: 'completed',
      bankName,
      accountNumber,
      reference: reference || `DEP-${Date.now()}`,
      currency: user.currency
    });

    await deposit.save({ session });

    // Update user's balance
    await User.findByIdAndUpdate(
      userId, 
      { $inc: { balance: amount } },
      { new: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Deposit successful',
      data: {
        amount,
        currency: user.currency,
        reference: deposit.reference
      }
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Deposit error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to process deposit',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};