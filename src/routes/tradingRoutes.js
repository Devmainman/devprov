import express from 'express';
import { 
  getTradeActivities,
  createTrade,
  getTotalProfit,
  getTotalTradesAmount,
  getActiveTrades,
  updateTradeStatus
} from '../controllers/tradingController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/trading/activities
// @desc    Get user's trade activities with totals
// @access  Private
router.get('/activities', authenticate, getTradeActivities);

// @route   POST /api/trading/create
// @desc    Create a new trade
// @access  Private
router.post('/create', authenticate, createTrade);

// @route   GET /api/trading/total-profit
// @desc    Get user's total profit across all trades
// @access  Private
router.get('/total-profit', authenticate, getTotalProfit);

// @route   GET /api/trading/total-amount
// @desc    Get user's total invested amount across all trades
// @access  Private
router.get('/total-amount', authenticate, getTotalTradesAmount);

// @route   GET /api/trading/active
// @desc    Get user's active trades
// @access  Private
router.get('/active', authenticate, getActiveTrades);

// @route   PUT /api/trading/:id/status
// @desc    Update trade status
// @access  Private
router.put('/:id/status', authenticate, updateTradeStatus);

export default router;