import express from 'express';
import { 
  completeProfile,
  // verifyPhone,
  uploadIdDocument,
  uploadAddressProof,
  uploadFaceImage,
  verifyOtp,
  saveAddress,
  getCurrentUser
} from '../controllers/verificationController.js';

import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Add to your verificationRoutes.js
router.get('/test-twilio', async (req, res) => {
    try {
      const testMessage = await twilioClient.messages.create({
        body: 'Twilio test message - your setup works!',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: '+2349052040538'  // Your test number (E.164 format)
      });
      
      console.log('Twilio test message SID:', testMessage.sid);
      res.json({ success: true, sid: testMessage.sid });
    } catch (err) {
      console.error('Twilio error:', err);
      res.status(500).json({ 
        error: err.message,
        twilioCode: err.code  // Helpful for debugging
      });
    }
  });

// @route   POST /api/verification/profile
// @desc    Complete user profile
// @access  Private
router.post('/profile', authenticate, completeProfile);

// @route   POST /api/verification/phone
// @desc    Send phone verification OTP
// @access  Private
// router.post('/phone', authenticate, verifyPhone);

// @route   POST /api/verification/verify-otp
// @desc    Verify phone OTP
// @access  Private
router.post('/verify-otp', authenticate, verifyOtp);

// @route   POST /api/verification/id-document
// @desc    Upload ID document
// @access  Private
router.post('/id-document', authenticate, uploadIdDocument);

// @route   POST /api/verification/address-proof
// @desc    Upload address proof
// @access  Private
router.post('/address-proof', authenticate, uploadAddressProof);

// @route   POST /api/verification/face-image
// @desc    Upload face image
// @access  Private
router.post('/face-image', authenticate, uploadFaceImage);

router.post('/address', authenticate, saveAddress);

// Add with your other routes
router.get('/users', authenticate, getCurrentUser);

export default router;