// controllers/adminTradingController.js
import Trade from '../models/Trade.js';
import TradePackage from '../models/TradePackage.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Get all trades (admin view)
export const getAllTrades = async (req, res) => {
  try {
    const { status, userId, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) query.userId = userId;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: {
        path: 'userId',
        select: 'accountId email firstName lastName'
      }
    };
    
    const trades = await Trade.paginate(query, options);
    
    res.json({
      success: true,
      trades: trades.docs,
      pagination: {
        total: trades.totalDocs,
        pages: trades.totalPages,
        page: trades.page,
        limit: trades.limit
      }
    });
  } catch (err) {
    console.error('Get all trades error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching trades' 
    });
  }
};

// Admin update trade status
export const adminUpdateTrade = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, progress, profit } = req.body;
    
    if (!status && !progress && !profit) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (status, progress, or profit) is required'
      });
    }
    
    const updates = {};
    if (status) updates.status = status;
    if (progress) updates.progress = progress;
    if (profit) updates.profit = profit;
    
    // If marking as completed, set end date and active to false
    if (status === 'completed') {
      updates.endDate = new Date();
      updates.active = false;
    }
    
    const updatedTrade = await Trade.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    ).populate('userId', 'accountId email firstName lastName');
    
    if (!updatedTrade) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Trade updated successfully',
      trade: updatedTrade
    });
  } catch (err) {
    console.error('Admin update trade error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating trade'
    });
  }
};

// Trade package CRUD operations
export const createTradePackage = async (req, res) => {
  try {
    const { name, description, minAmount, maxAmount, rate, interval, duration, currency, status } = req.body;
    
    // Validate
    if (!name || !minAmount || !maxAmount || !rate || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, minAmount, maxAmount, rate, duration'
      });
    }
    
    if (minAmount >= maxAmount) {
      return res.status(400).json({
        success: false,
        message: 'maxAmount must be greater than minAmount'
      });
    }
    
    const newPackage = new TradePackage({
      name,
      description,
      minAmount,
      maxAmount,
      rate,
      interval,
      duration,
      currency,
      status
    });
    
    await newPackage.save();
    
    res.status(201).json({
      success: true,
      message: 'Trade package created successfully',
      package: newPackage
    });
  } catch (err) {
    console.error('Create trade package error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error creating trade package'
    });
  }
};

export const getTradePackages = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };
    
    const packages = await TradePackage.paginate(query, options);
    
    res.json({
      success: true,
      packages: packages.docs,
      pagination: {
        total: packages.totalDocs,
        pages: packages.totalPages,
        page: packages.page,
        limit: packages.limit
      }
    });
  } catch (err) {
    console.error('Get trade packages error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching trade packages' 
    });
  }
};

export const updateTradePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (updates.minAmount && updates.maxAmount && updates.minAmount >= updates.maxAmount) {
      return res.status(400).json({
        success: false,
        message: 'maxAmount must be greater than minAmount'
      });
    }
    
    const updatedPackage = await TradePackage.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );
    
    if (!updatedPackage) {
      return res.status(404).json({
        success: false,
        message: 'Trade package not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Trade package updated successfully',
      package: updatedPackage
    });
  } catch (err) {
    console.error('Update trade package error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating trade package'
    });
  }
};

export const deleteTradePackage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedPackage = await TradePackage.findByIdAndDelete(id);
    
    if (!deletedPackage) {
      return res.status(404).json({
        success: false,
        message: 'Trade package not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Trade package deleted successfully'
    });
  } catch (err) {
    console.error('Delete trade package error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error deleting trade package'
    });
  }
};

// Admin trade statistics
export const getTradeStatistics = async (req, res) => {
  try {
    const [totalTrades, activeTrades, completedTrades, totalProfit] = await Promise.all([
      Trade.countDocuments(),
      Trade.countDocuments({ status: 'in-progress' }),
      Trade.countDocuments({ status: 'completed' }),
      Trade.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$profit' } } }
      ])
    ]);
    
    const profit = totalProfit.length > 0 ? totalProfit[0].total : 0;
    
    res.json({
      success: true,
      statistics: {
        totalTrades,
        activeTrades,
        completedTrades,
        totalProfit: profit
      }
    });
  } catch (err) {
    console.error('Get trade statistics error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching trade statistics' 
    });
  }
};