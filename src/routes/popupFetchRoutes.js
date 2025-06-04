import express from 'express';
import {
  getAvailablePopupForms,
  getAvailablePopupInvoices,
  getAvailablePopupMessages,
  submitPopupForm,
  payPopupInvoice,
  acknowledgePopupMessage,
  getUserFormSubmissions
} from '../controllers/popupFetchController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET endpoints (require authentication)
router.get('/popup-forms', authenticate, getAvailablePopupForms);
router.get('/popup-invoices', authenticate, getAvailablePopupInvoices);
router.get('/popup-messages', authenticate, getAvailablePopupMessages);
router.get('/form-submissions', authenticate, getUserFormSubmissions);

// POST/PATCH endpoints
router.post('/popup-forms/:itemId/submit', authenticate, submitPopupForm);
router.post('/popup-invoices/:itemId/pay', authenticate, payPopupInvoice);
router.patch('/popup-messages/:itemId/acknowledge', authenticate, acknowledgePopupMessage);

export default router;