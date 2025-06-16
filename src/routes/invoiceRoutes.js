import express from 'express';
import {
  getInvoices,
  updateInvoiceStatus,
  deleteInvoice
} from '../controllers/invoiceController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply admin authentication to all routes
router.use( authenticate, isAdmin );

// GET /api/admin/invoices - Get invoices with pagination
router.get('/', getInvoices);

// PATCH /api/admin/invoices/:id/status - Update invoice status
router.patch('/:id/status', updateInvoiceStatus);

// DELETE /api/admin/invoices/:id - Delete invoice
router.delete('/:id', deleteInvoice);

export default router;