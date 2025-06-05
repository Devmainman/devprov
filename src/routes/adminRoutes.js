import express from 'express';
import { 
  login, 
  createAdmin, 
  verifyAdmin,
} from '../controllers/adminController.js';
import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  updateWalletBalance,
  assignPackage,
  assignPopupForm,
  assignPopupInvoice,
  assignPopupMessage,
  resetUserPassword,
  toggleWithdrawalLock,
  generateAdminAccess,
  requestEmailVerification,
  requestPhoneVerification,
  changeUserCurrency,
  deleteUserAccount,
  assignBotToUser,
  toggleTradeStatus,
  updateUserSignal,
  sendMessageToUser
} from '../controllers/adminUserController.js';

import { getSettings, saveSettings } from '../controllers/settingsController.js';

import {
  assignToUser,
  getUserAssignments,
  updateAssignmentStatus
} from '../controllers/assignmentController.js';
import {
  getDashboardStats,
  getUserGrowth
} from '../controllers/dashboardController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Admin Authentication
router.post('/login', login);
router.get('/verify', authenticate, isAdmin, verifyAdmin);
router.post('/create-admin', createAdmin); // TODO: Remove after initial setup

// Apply admin middleware to all routes below
router.use(authenticate);
router.use(isAdmin);

// User management routes
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/status', toggleUserStatus);
router.patch('/users/:id/wallet', updateWalletBalance);

// New settings routes
router.get('/settings', authenticate, isAdmin, getSettings);
router.post('/settings', authenticate, isAdmin, saveSettings);

// User action routes
router.patch('/users/:id/withdrawal-lock', toggleWithdrawalLock);
router.post('/users/:id/admin-access', generateAdminAccess);
router.post('/users/:id/request-email-verification', requestEmailVerification);
router.post('/users/:id/request-phone-verification', requestPhoneVerification);
router.patch('/users/:id/currency', changeUserCurrency);
router.delete('/users/:id/account', deleteUserAccount);
router.post('/users/:id/assign-bot', assignBotToUser);
router.patch('/users/:id/trade-status', toggleTradeStatus);
router.patch('/users/:id/signal', updateUserSignal);
router.post('/users/:id/send-message', sendMessageToUser);

// Assignment routes
router.post('/users/:userId/packages/:packageId', assignPackage);
router.post('/users/:id/reset-password', resetUserPassword);
router.post('/users/:userId/popup-forms/:popupFormId', assignPopupForm);
router.post('/users/:userId/popup-invoices/:popupInvoiceId', assignPopupInvoice);
router.post('/users/:userId/popup-messages/:popupMessageId', assignPopupMessage);
// router.post('/assign/:userId/:type', assignToUser);
// router.get('/assignments/:userId', getUserAssignments);
// router.patch('/assignments/:assignmentId/status', updateAssignmentStatus);

// Dashboard routes
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/user-growth', getUserGrowth);

router.patch('/users/:id', updateUser);

// Test Routes
router.get('/dashboard', (req, res) => {
  res.json({ message: 'Admin dashboard' });
});

router.get('/auth-test', (req, res) => {
  res.json({
    auth: req.auth,
    headers: req.headers,
    verified: true
  });
});

export default router;