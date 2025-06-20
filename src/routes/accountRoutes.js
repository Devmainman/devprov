import express from 'express';
import { 
  getBalance, 
} from '../controllers/accountController.js';
import { createDeposit } from '../controllers/paymentController.js';
import { getTransactions } from '../controllers/transactionController.js';

import { authenticate } from '../middleware/auth.js';

const router = express.Router();


router.get('/transactions', authenticate, getTransactions);
// @route   GET /api/account/balance
// @desc    Get user balance and account information
// @access  Private
router.get('/balance', authenticate, getBalance);

// @route   GET /api/account/transactions
// @desc    Get user transactions
// @access  Private
router.get('/transactions', authenticate, getTransactions);

router.post('/deposit', authenticate, createDeposit);


// router.post('/deposit', authenticate, createDeposit);

export default router;