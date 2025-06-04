import express from 'express';
import {
  getReferralInfo,
  getReferralStats,
  getReferredUsers,
  withdrawReferralBonus
} from '../controllers/referralController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get complete referral information
router.get('/', authenticate, getReferralInfo);

// Get referral statistics (simplified version)
router.get('/stats', authenticate, getReferralStats);

// Get list of referred users
router.get('/users', authenticate, getReferredUsers);

// Withdraw referral bonus
router.post('/withdraw', authenticate, withdrawReferralBonus);

export default router;