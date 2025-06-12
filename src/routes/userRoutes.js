// routes/userRoutes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { signup, login, getCurrentUser, changePassword, submitPopupForm, payPopupInvoice, acknowledgePopupMessage, getUserAssignments } from '../controllers/userController.js';
import { getActivePopup, completePopup, getAvailablePopupForms, getAvailablePopupInvoices, getAvailablePopupMessages } from '../controllers/popupController.js';

const router = express.Router();

// User authentication routes
router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);
router.post('/change-password', authenticate, changePassword);

// Popup routes
router.get('/popups/active',
    (req, res, next) => {
      console.log('Entering /popups/active');
      next();
    },
    authenticate,
    (req, res, next) => {
      console.log('After authenticate:', req.user);
      next();
    },
    getActivePopup
  );; // Ensure only authenticate
router.post('/popups/:id/complete', authenticate, completePopup);
router.post('/popups/forms/:id/submit', authenticate, submitPopupForm);
router.post('/popups/invoices/:id/pay', authenticate, payPopupInvoice);
router.patch('/popups/messages/:id/acknowledge', authenticate, acknowledgePopupMessage);

router.post('/popup-forms/:formId/submit', authenticate, submitPopupForm);
router.post('/popup-invoices/:invoiceId/pay', authenticate, payPopupInvoice);
router.post('/popup-messages/:messageId/acknowledge', authenticate, acknowledgePopupMessage);
router.get('/assignments', authenticate, getUserAssignments);

// Available popups
router.get('/popups/available/forms', authenticate, getAvailablePopupForms);
router.get('/popups/available/invoices', authenticate, getAvailablePopupInvoices);
router.get('/popups/available/messages', authenticate, getAvailablePopupMessages);

export default router;