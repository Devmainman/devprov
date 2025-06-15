import Transaction from '../models/Transaction.js';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js'; // Ensure you have a Withdrawal model
import User from '../models/User.js';

export const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user.id;

    // Fetch transactions from both collections
    const [deposits, withdrawals, totalDeposits, totalWithdrawals] = await Promise.all([
      Deposit.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Withdrawal.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Deposit.countDocuments({ userId }),
      Withdrawal.countDocuments({ userId })
    ]);

    // Combine and format transactions
    const combinedTransactions = [
      ...deposits.map(d => ({
        id: d._id,
        type: 'deposit',
        amount: d.amount,
        currency: d.currency,
        status: d.status,
        reference: d.transactionReference,
        createdAt: d.createdAt
      })),
      ...withdrawals.map(w => ({
        id: w._id,
        type: 'withdrawal',
        amount: w.amount,
        currency: w.currency,
        status: w.status,
        reference: w.transactionReference,
        createdAt: w.createdAt
      }))
    ].sort((a, b) => b.createdAt - a.createdAt);

    const total = totalDeposits + totalWithdrawals;

    res.json({
      success: true,
      data: {
        transactions: combinedTransactions,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (err) {
    console.error('Get transactions error:', {
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
      const userId = req.user._id;
  
      // Validate input
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'A valid deposit amount is required'
        });
      }
  
      // Create deposit transaction
      const deposit = new Transaction({
        userId,
        amount,
        type: 'deposit',
        status: 'completed', // Auto-complete deposits
        bankName,
        accountNumber,
        reference: reference || `DEP-${Date.now()}`,
        currency: 'NGN'
      });
  
      await deposit.save();
  
      // Update user's balance (if you're maintaining a separate balance field)
      await User.findByIdAndUpdate(userId, {
        $inc: { balance: amount }
      });
  
      res.status(201).json({
        success: true,
        message: 'Deposit successful',
        data: {
          newBalance: deposit.amount,
          reference: deposit.reference
        }
      });
  
    } catch (err) {
      console.error('Deposit error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to process deposit'
      });
    }
  };

  export const getAllTransactions = async (req, res) => {
    try {
      const { page = 1, limit = 20, type, status, userId } = req.query;
      
      const query = {};
      if (type) query.type = type;
      if (status) query.status = status;
      if (userId) query.userId = userId;
      
      const transactions = await Transaction.find(query)
        .populate('userId', 'fullName accountId email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      const total = await Transaction.countDocuments(query);
      
      res.json({
        success: true,
        transactions,
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      });
    } catch (err) {
      console.error('Get all transactions error:', err);
      res.status(500).json({
        success: false,
        message: 'Server error fetching transactions'
      });
    }
  };
  
  export const updateTransactionStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!['pending', 'completed', 'failed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction status'
        });
      }
      
      const transaction = await Transaction.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      ).populate('userId', 'fullName accountId');
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }
      
      // If completing a deposit, update user balance
      if (status === 'completed' && transaction.type === 'deposit') {
        await User.findByIdAndUpdate(
          transaction.userId,
          { $inc: { walletBalance: transaction.amount } }
        );
      }
      
      res.json({
        success: true,
        transaction
      });
    } catch (err) {
      console.error('Update transaction error:', err);
      res.status(500).json({
        success: false,
        message: 'Server error updating transaction'
      });
    }
  };