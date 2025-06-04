import User from '../models/User.js';
import Transaction from '../models/Transaction.js';


export const getBalance = async (req, res) => {
  try {
    // Get user with balance information
    const user = await User.findById(req.user.id)
      .select('accountId currency verification balance')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate balance from transactions (more accurate method)
    const balanceResult = await Transaction.aggregate([
      { 
        $match: { 
          userId: req.user._id, 
          status: 'completed' 
        } 
      },
      {
        $group: {
          _id: null,
          balance: {
            $sum: {
              $cond: [
                { $eq: ["$type", "deposit"] },
                "$amount",
                { $multiply: ["$amount", -1] } // withdrawals are negative
              ]
            }
          }
        }
      }
    ]);

    const calculatedBalance = balanceResult[0]?.balance || 0;
    const storedBalance = user.balance || 0;

    // If there's a discrepancy, update the user's balance field
    if (calculatedBalance !== storedBalance) {
      await User.findByIdAndUpdate(req.user.id, {
        $set: { balance: calculatedBalance }
      });
    }

    // Calculate hourly change
    const oneHourAgo = new Date(Date.now() - 3600000);
    const previousBalanceResult = await Transaction.aggregate([
      { 
        $match: { 
          userId: req.user._id, 
          status: 'completed',
          createdAt: { $lt: oneHourAgo }
        } 
      },
      {
        $group: {
          _id: null,
          balance: {
            $sum: {
              $cond: [
                { $eq: ["$type", "deposit"] },
                "$amount",
                { $multiply: ["$amount", -1] }
              ]
            }
          }
        }
      }
    ]);

    const previousBalance = previousBalanceResult[0]?.balance || 0;
    const changeAmount = calculatedBalance - previousBalance;
    const changePercentage = previousBalance !== 0 
      ? ((changeAmount / previousBalance) * 100).toFixed(2)
      : '0.00';

    res.json({
      success: true,
      data: {
        balance: calculatedBalance,
        currency: user.currency || 'NGN',
        change: {
          amount: Math.abs(changeAmount),
          percentage: Math.abs(changePercentage),
          direction: changeAmount >= 0 ? 'up' : 'down'
        },
        accountId: user.accountId,
        verificationStatus: user.verification
      }
    });

  } catch (err) {
    console.error('Balance calculation error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate balance',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };
    
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

    res.json({
      success: true,
      data: {
        transactions: transactions.map(t => ({
          ...t,
          createdAt: t.createdAt.toISOString()
        })),
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          limit
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
        status: 'completed',
        bankName,
        accountNumber,
        reference: reference || `DEP-${Date.now()}`,
        currency: 'NGN'
      });
  
      await deposit.save();
  
      // Update user's balance field
      await User.findByIdAndUpdate(userId, {
        $inc: { balance: amount }
      });
  
      // Get updated balance
      const updatedUser = await User.findById(userId).select('balance');
  
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