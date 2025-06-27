import express from 'express';
import { getActiveWithdrawalMethods } from '../controllers/withdrawalMethodController.js';
import { authenticate } from '../middleware/auth.js'; // 👈 import it

const router = express.Router();

// Secure the route
router.get('/withdrawal-methods', authenticate, getActiveWithdrawalMethods);

export default router;
