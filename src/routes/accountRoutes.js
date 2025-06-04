import express from 'express';
import { 
  getBalance,
  getTransactions,
  createDeposit
} from '../controllers/accountController.js';

import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/account/balance
// @desc    Get user balance and account information
// @access  Private
router.get('/balance', authenticate, getBalance);

// @route   GET /api/account/transactions
// @desc    Get user transactions
// @access  Private
router.get('/transactions', authenticate, getTransactions);


router.post('/deposit', authenticate, createDeposit);

export default router;