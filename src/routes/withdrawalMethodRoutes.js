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

// Debug middleware
router.use((req, res, next) => {
  console.log(`Withdrawal Route Hit: ${req.method} ${req.originalUrl}`);
  next();
});

// Apply authentication and admin check
router.use(authenticate, isAdmin);

// Define routes
router.route('/')
  .get((req, res, next) => {
    console.log('GET / route matched');
    next();
  }, getWithdrawalMethods)
  .post((req, res, next) => {
    console.log('POST / route matched');
    next();
  }, createWithdrawalMethod);

router.route('/:id')
  .put((req, res, next) => {
    console.log(`PUT /${req.params.id} route matched`);
    next();
  }, updateWithdrawalMethod)
  .delete((req, res, next) => {
    console.log(`DELETE /${req.params.id} route matched`);
    next();
  }, deleteWithdrawalMethod);

router.patch('/:id/status', (req, res, next) => {
  console.log(`PATCH /${req.params.id}/status route matched`);
  next();
}, toggleMethodStatus);

// Fallback for unmatched routes
router.use((req, res) => {
  console.log(`Withdrawal Route Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ success: false, message: 'Route not found in withdrawal methods' });
});

export default router;