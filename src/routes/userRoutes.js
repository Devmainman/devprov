// routes/userRoutes.js
import express from 'express';
import multer from 'multer';
import bodyParser from 'body-parser';
import { authenticate } from '../middleware/auth.js';
import Currency from '../models/Currency.js';
import User from '../models/User.js';
import { signup, login, getCurrentUser, changePassword, submitPopupForm, payPopupInvoice, getUserAssignments } from '../controllers/userController.js';
import { getActivePopup, completePopup, getAvailablePopupForms, getAvailablePopupInvoices, acknowledgePopupMessage, getAvailablePopupMessages } from '../controllers/popupController.js';

const router = express.Router();


// Create a custom form parser
const parseFormData = (req, res, next) => {
  // Check if we should expect multipart data
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
  
  if (!isMultipart) {
    // Handle JSON directly
    return bodyParser.json()(req, res, next);
  }

  // Configure multer
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      fields: 100,
      files: 10
    }
  }).any(); // Accept any files

  // Parse with multer
  upload(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      // Try to parse as JSON instead
      req.files = [];
      return bodyParser.json()(req, res, (jsonErr) => {
        if (jsonErr) {
          console.error('JSON parse error:', jsonErr);
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid request format' 
          });
        }
        next();
      });
    }
    next();
  });
};




// User authentication routes
router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);
router.post('/change-password', authenticate, changePassword);

// Popup routes
router.get('/popups/active', authenticate, getActivePopup);
router.post('/popups/:id/complete', authenticate, completePopup);

// Form submission route with enhanced parsing
router.post(
  '/popup-forms/:formId/submit',
  authenticate,
  parseFormData,
  (req, res, next) => {
    // Debug middleware
    console.log('Received submission:', {
      params: req.params,
      body: req.body,
      files: req.files?.map(f => ({
        fieldname: f.fieldname,
        originalname: f.originalname,
        size: f.size
      })),
      user: req.user
    });

    // Ensure assignmentId exists
    if (!req.body.assignmentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing assignment ID' 
      });
    }

    next();
  },
  submitPopupForm
);

// Other routes remain unchanged
router.post('/popup-invoices/:invoiceId/pay', authenticate, payPopupInvoice); 
router.post('/popup-messages/:assignmentId/acknowledge', authenticate, acknowledgePopupMessage);
router.get('/assignments', authenticate, getUserAssignments);
router.get('/popups/available/forms', authenticate, getAvailablePopupForms);
router.get('/popups/available/invoices', authenticate, getAvailablePopupInvoices);
router.get('/popups/available/messages', authenticate, getAvailablePopupMessages);

router.put('/preferences', authenticate, async (req, res) => {
  const { currency: newCurrencyCode } = req.body;

  const newCurrency = await Currency.findOne({ code: newCurrencyCode, status: 'Enabled' });
  if (!newCurrency) return res.status(400).json({ message: 'Invalid currency code' });

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const oldCurrency = await Currency.findOne({ code: user.currency });
  const oldRate = oldCurrency?.rate || 1;
  const newRate = newCurrency.rate;

  console.log(`User current balance: ${user.balance} ${user.currency}`);
  console.log(`Old currency rate (to USD): ${oldRate}`);
  console.log(`New currency rate (to USD): ${newRate}`);

  if (user.currency !== newCurrencyCode) {
    const convertedBalance = (user.balance / oldRate) * newRate;
    console.log(`Converted balance in ${newCurrencyCode}: ${convertedBalance}`);
    
    user.balance = convertedBalance;
    user.currency = newCurrencyCode;

    await user.save(); // ✅ This is what saves the new currency and balance!
  }

  res.json({ 
    success: true, 
    message: 'Currency and balance updated',
    currency: user.currency,
    balance: user.balance
  });
});




router.get('/currencies', async (req, res) => {
  const currencies = await Currency.find({ status: 'Enabled' }).select('title code');
  res.json({ success: true, data: currencies });
});



export default router;