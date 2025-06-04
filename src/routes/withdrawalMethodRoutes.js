import express from 'express';
import {
  getWithdrawalMethods,
  createWithdrawalMethod,
  updateWithdrawalMethod,
  toggleMethodStatus,
  deleteWithdrawalMethod
} from '../controllers/withdrawalMethodController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin check to all routes
router.use(authenticate, isAdmin);

// Update paths to include full route
router.route('/withdrawal-methods')
  .get(getWithdrawalMethods)
  .post(createWithdrawalMethod);

router.route('/withdrawal-methods/:id')
  .put(updateWithdrawalMethod)
  .delete(deleteWithdrawalMethod);

router.patch('/withdrawal-methods/:id/status', toggleMethodStatus);

export default router;