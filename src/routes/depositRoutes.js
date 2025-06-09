import express from 'express';
import { 
  getDeposits,
  updateDepositStatus,
  deletePaymentProof,
  deleteDeposit,
  createDeposit,
  getUserDeposits
} from '../controllers/DepositController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// User routes
router.post('/', authenticate, createDeposit); 
router.get('/my-deposits', authenticate, getUserDeposits);

// Admin routes
router.get('/', authenticate, isAdmin, getDeposits);
router.put('/:id/status', authenticate, isAdmin, updateDepositStatus);
router.delete('/:id', authenticate, isAdmin, deleteDeposit);
router.delete('/:id/proof', authenticate, isAdmin, deletePaymentProof);

export default router;