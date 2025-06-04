import express from 'express';
import { getActiveWithdrawalMethods } from '../controllers/withdrawalMethodController.js';

const router = express.Router();

// Public route
router.get('/withdrawal-methods', getActiveWithdrawalMethods);

export default router;