// routes/withdrawalRoutes.js
import express from 'express';
import { 
  createWithdrawal,
  getUserWithdrawals
} from '../controllers/WithdrawalController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.use(authenticate);

router.post('/', createWithdrawal);
router.get('/', getUserWithdrawals);

export default router;