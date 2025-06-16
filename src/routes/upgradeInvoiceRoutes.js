import express from 'express';
import {
  createUpgradeInvoice,
  getUpgradeInvoices,
  updateUpgradeInvoiceStatus,
  deleteUpgradeInvoice
} from '../controllers/upgradeInvoiceController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// User routes
router.post('/', authenticate, createUpgradeInvoice);

// Admin routes
router.get('/admin', authenticate, isAdmin, getUpgradeInvoices);
router.patch('/admin/:id/status', authenticate, isAdmin, updateUpgradeInvoiceStatus);
router.delete('/admin/:id', authenticate, isAdmin, deleteUpgradeInvoice);

export default router;