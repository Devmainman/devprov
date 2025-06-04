import express from 'express';
import { 
  getIdVerifications,
  updateIdVerification,
  getAddressVerifications,
  updateAddressVerification,
  getFacialVerifications,
  updateFacialVerification,
  getVerificationCounts
} from '../controllers/adminVerificationController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// ID Verification Routes
router.get('/id-verifications', authenticate, isAdmin, getIdVerifications);
router.put('/id-verifications/:userId/:documentId', authenticate, isAdmin, updateIdVerification);

// Address Verification Routes
router.get('/address-verifications', authenticate, isAdmin, getAddressVerifications);
router.put('/address-verifications/:userId', authenticate, isAdmin, updateAddressVerification);

// Facial Verification Routes
router.get('/facial-verifications', authenticate, isAdmin, getFacialVerifications);
router.put('/facial-verifications/:userId', authenticate, isAdmin, updateFacialVerification);

// Dashboard Stats
router.get('/verification-counts', authenticate, isAdmin, getVerificationCounts);

export default router;