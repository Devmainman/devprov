import express from 'express';
import { signup, login, getCurrentUser, changePassword } from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { 
  getActivePopup,
  completePopup,
  submitPopupForm,
  payPopupInvoice,
  acknowledgePopupMessage,
  getAvailablePopupForms,
  getAvailablePopupInvoices,
  getAvailablePopupMessages
} from '../controllers/popupController.js';

const router = express.Router();

// User authentication routes
router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);
router.post('/change-password', authenticate, changePassword);

// Popup routes
router.get('/popups/active', authenticate, getActivePopup);
router.post('/popups/:id/complete', authenticate, completePopup);
router.post('/popups/forms/:id/submit', authenticate, submitPopupForm);
router.post('/popups/invoices/:id/pay', authenticate, payPopupInvoice);
router.patch('/popups/messages/:id/acknowledge', authenticate, acknowledgePopupMessage);

// Available popups (for admin or listing purposes)
router.get('/popups/available/forms', authenticate, getAvailablePopupForms);
router.get('/popups/available/invoices', authenticate, getAvailablePopupInvoices);
router.get('/popups/available/messages', authenticate, getAvailablePopupMessages);

export default router;