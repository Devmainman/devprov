import express from 'express';
import { 
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  togglePaymentMethodStatus
} from '../../controllers/admin/paymentController.js';
import { authenticate, isAdmin } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticate, isAdmin);

// Payment method management routes
router.get('/payment-methods', getPaymentMethods);
router.post('/payment-methods', createPaymentMethod);
router.put('/payment-methods/:id', updatePaymentMethod);
router.delete('/payment-methods/:id', deletePaymentMethod);
router.patch('/payment-methods/:id/status', togglePaymentMethodStatus);

export default router;