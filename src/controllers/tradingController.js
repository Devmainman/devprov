import mongoose from 'mongoose';
import Trade from '../models/Trade.js';
import User from '../models/User.js';

export const getTradeActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Get trades for this user, sorted by most recent
    const trades = await Trade.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate totals
    const totalAmount = trades.reduce((sum, trade) => sum + trade.amount, 0);
    const totalProfit = trades.reduce((sum, trade) => sum + trade.profit, 0);

    // Format the data for frontend
    const formattedTrades = trades.map(trade => ({
      id: trade._id,
      name: trade.name,
      date: new Date(trade.createdAt).toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      amount: `${trade.amount} ${trade.currency}`,
      profit: `${trade.profit} ${trade.currency}`,
      status: trade.status,
      progress: trade.progress,
      active: trade.active
    }));

    res.json({ 
      success: true,
      trades: formattedTrades,
      totals: {
        amount: `${totalAmount} ${trades[0]?.currency || 'NGN'}`, // Default to NGN if no trades exist
        profit: `${totalProfit} ${trades[0]?.currency || 'NGN'}`
      }
    });

  } catch (err) {
    console.error('Trade activities error:', err);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Server error fetching trade activities' 
    });
  }
};

export const createTrade = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, amount, profit } = req.body;

    // Basic validation
    if (!name || !amount || !profit) {
      return res.status(400).json({
        success: false,
        message: 'Name, amount and profit are required'
      });
    }

    // Validate amount and profit are numbers
    if (isNaN(amount) || isNaN(profit)) {
      return res.status(400).json({
        success: false,
        message: 'Amount and profit must be valid numbers'
      });
    }

    // Create new trade
    const newTrade = new Trade({
      userId,
      name,
      amount: parseFloat(amount),
      profit: parseFloat(profit),
      status: 'pending'
    });

    await newTrade.save();

    res.status(201).json({
      success: true,
      message: 'Trade created successfully',
      trade: {
        ...newTrade.toObject(),
        amount: `${newTrade.amount} ${newTrade.currency}`,
        profit: `${newTrade.profit} ${newTrade.currency}`
      }
    });

  } catch (err) {
    console.error('Create trade error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error creating trade'
    });
  }
};

export const getTotalProfit = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await Trade.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { 
          _id: null, 
          totalProfit: { $sum: "$profit" },
          currency: { $first: "$currency" }
        } 
      }
    ]);

    const total = result[0] || { totalProfit: 0, currency: 'NGN' };
    
    res.json({ 
      success: true,
      totalProfit: total.totalProfit,
      formattedProfit: `${total.totalProfit} ${total.currency}`,
      currency: total.currency
    });

  } catch (err) {
    console.error('Get total profit error:', err);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Server error fetching total profit' 
    });
  }
};

export const getTotalTradesAmount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await Trade.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { 
          _id: null, 
          totalAmount: { $sum: "$amount" },
          currency: { $first: "$currency" }
        } 
      }
    ]);

    const total = result[0] || { totalAmount: 0, currency: 'NGN' };
    
    res.json({ 
      success: true,
      totalAmount: total.totalAmount,
      formattedAmount: `${total.totalAmount} ${total.currency}`,
      currency: total.currency
    });

  } catch (err) {
    console.error('Get total amount error:', err);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Server error fetching total trades amount' 
    });
  }
};

export const getActiveTrades = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const activeTrades = await Trade.find({ 
      userId,
      active: true 
    }).sort({ createdAt: -1 }).lean();

    res.json({ 
      success: true,
      count: activeTrades.length,
      trades: activeTrades 
    });

  } catch (err) {
    console.error('Get active trades error:', err);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Server error fetching active trades' 
    });
  }
};

export const updateTradeStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'in-progress', 'completed', 'paused', 'terminated'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }

    const updatedTrade = await Trade.findOneAndUpdate(
      { _id: id, userId },
      { status },
      { new: true }
    );

    if (!updatedTrade) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found'
      });
    }

    res.json({
      success: true,
      message: 'Trade status updated',
      trade: updatedTrade
    });

  } catch (err) {
    console.error('Update trade status error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error updating trade status'
    });
  }
};