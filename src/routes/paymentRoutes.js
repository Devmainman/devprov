import express from 'express';
import { 
  getPaymentMethods,
  createDeposit,
  getDepositHistory
} from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get available payment methods
router.get('/methods', authenticate, getPaymentMethods);

// Create a deposit request
router.post('/deposit', authenticate, createDeposit);

// Get user's deposit history
router.get('/deposits', authenticate, getDepositHistory);

export default router;