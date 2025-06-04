// controllers/withdrawalController.js
import Withdrawal from '../models/Withdrawal.js';
import WithdrawalMethod from '../models/WithdrawalMethod.js';
import User from '../models/User.js';

export const createWithdrawal = async (req, res) => {
  try {
    const { methodId, amount, details } = req.body;
    const userId = req.user._id;

    // Validate method exists and is active
    const method = await WithdrawalMethod.findOne({ 
      methodId,
      isActive: true 
    });
    
    if (!method) {
      return res.status(400).json({ 
        message: 'Withdrawal method not available' 
      });
    }

    // Validate amount range
    if (amount < method.minAmount || amount > method.maxAmount) {
      return res.status(400).json({ 
        message: `Amount must be between ${method.minAmount} and ${method.maxAmount}`
      });
    }

    // Check user balance (assuming User model has balance field)
    const user = await User.findById(userId);
    if (user.balance < amount) {
      return res.status(400).json({ 
        message: 'Insufficient balance' 
      });
    }

    // Validate all required details are provided
    const missingDetails = method.details.filter(methodDetail => 
      !details.some(d => d.label === methodDetail.label)
    );
    
    if (missingDetails.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingDetails.map(d => d.label).join(', ')}`
      });
    }

    // Create withdrawal
    const withdrawal = new Withdrawal({
      user: userId,
      method: method._id,
      amount,
      details,
      status: 'pending'
    });

    await withdrawal.save();

    // Deduct from user balance (or implement hold system)
    user.balance -= amount;
    await user.save();

    res.status(201).json(withdrawal);

  } catch (err) {
    console.error('Withdrawal error:', err);
    res.status(500).json({ 
      message: 'Error processing withdrawal',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user._id })
      .populate('method', 'title methodId icon');
      
    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching withdrawals' });
  }
};