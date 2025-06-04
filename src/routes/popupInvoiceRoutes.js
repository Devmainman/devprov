// routes/admin/popupInvoiceRoutes.js
import express from 'express';
import {
  getPopupInvoices,
  createPopupInvoice,
  updatePopupInvoice,
  deletePopupInvoice
} from '../controllers/popupInvoiceController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(authenticate, isAdmin, getPopupInvoices)
  .post(authenticate, isAdmin, createPopupInvoice);

router.route('/:id')
  .put(authenticate, isAdmin, updatePopupInvoice)
  .delete(authenticate, isAdmin, deletePopupInvoice);

export default router;