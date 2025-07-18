import Transaction from '../models/Transaction.js';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js'; // Ensure you have a Withdrawal model
import User from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';

export const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user.id;

    // Fetch deposits, withdrawals, admin credits, and referral bonuses separately
    const [
        deposits,
        withdrawals,
        adminCredits,
        referralBonuses,
        upgradeTransactions,
        totalDeposits,
        totalWithdrawals,
        totalAdminCredits,
        totalReferralBonuses,
        totalUpgradeTransactions // ← Add this
      ] = await Promise.all([
        Deposit.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Withdrawal.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Transaction.find({ userId, type: 'admin_credit', status: 'completed' }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Transaction.find({ userId, type: 'referral_bonus', status: 'completed' }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Transaction.find({ userId, type: 'upgrade' }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Deposit.countDocuments({ userId }),
        Withdrawal.countDocuments({ user: userId }),
        Transaction.countDocuments({ userId, type: 'admin_credit', status: 'completed' }),
        Transaction.countDocuments({ userId, type: 'referral_bonus', status: 'completed' }),
        Transaction.countDocuments({ userId, type: 'upgrade' }) // 👈 Here
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
        reference: w._id.toString(),
        createdAt: w.createdAt
      })),
      ...adminCredits.map(ac => ({
        id: ac._id,
        type: 'deposit', // Keep admin_credit shown as deposit
        amount: ac.amount,
        currency: ac.currency,
        status: ac.status,
        reference: ac.reference || `ADMIN-CREDIT-${ac._id.toString().slice(-6)}`,
        createdAt: ac.createdAt,
        isAdminCredit: true
      })),
      ...referralBonuses.map(rb => ({
        id: rb._id,
        type: 'Referral Bonus', // Show referral_bonus with its own type
        amount: rb.amount,
        currency: rb.currency,
        status: rb.status,
        reference: rb.reference || `REF-BONUS-${rb._id.toString().slice(-6)}`,
        createdAt: rb.createdAt
      })),
      ...upgradeTransactions.map(upg => ({
        id: upg._id,
        type: 'Account Upgrade',
        amount: upg.amount,
        currency: upg.currency,
        status: upg.status,
        reference: upg.reference || `UPGRADE-${upg._id.toString().slice(-6)}`,
        createdAt: upg.createdAt
      }))
    ].sort((a, b) => b.createdAt - a.createdAt);

    const total = totalDeposits + totalWithdrawals + totalAdminCredits + totalReferralBonuses + totalUpgradeTransactions;

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

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid deposit amount is required'
      });
    }

    // Fetch user currency
    const user = await User.findById(userId).lean();
    const currency = user?.currency; // fallback

    const deposit = new Transaction({
      userId,
      amount,
      type: 'deposit',
      status: 'completed',
      bankName,
      accountNumber,
      reference: reference || `DEP-${Date.now()}`,
      currency  // ← use dynamic currency
    });

    await deposit.save();

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