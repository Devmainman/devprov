import PaymentMethod from '../models/PaymentMethod.js';
import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Configure __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all active payment methods
export const getPaymentMethods = async (req, res) => {
  try {
    console.log('Incoming request headers:', req.headers);
    console.log('Authenticated user:', req.user);

    const methods = await PaymentMethod.find({ isActive: true });
    console.log('Found methods:', methods);

    if (!methods.length) {
      console.warn('No active payment methods found in DB');
    }

    res.json({
      success: true,
      data: methods.map(m => ({
        ...m.toObject(),
        id: m.methodId
      }))
    });
  } catch (err) {
    console.error('Controller error:', err);
    res.status(500).json({ 
      success: false,
      message: err.message
    });
  }
};

// Create a deposit request
export const createDeposit = async (req, res) => {
  try {
    console.log('req.user:', req.user);

    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const { paymentMethodId, amount, currency } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!paymentMethodId || !amount || !currency) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Check payment method exists and is active
    const paymentMethod = await PaymentMethod.findOne({ 
      methodId: paymentMethodId, 
      isActive: true 
    });
    
    if (!paymentMethod) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment method' 
      });
    }

    // Validate amount against min/max if set
    if (paymentMethod.minAmount && amount < paymentMethod.minAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum deposit amount is ${paymentMethod.minAmount}` 
      });
    }

    if (paymentMethod.maxAmount && amount > paymentMethod.maxAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `Maximum deposit amount is ${paymentMethod.maxAmount}` 
      });
    }

    // Handle file upload
    if (!req.files || !req.files.paymentProof) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment proof is required' 
      });
    }

    const paymentProof = req.files.paymentProof;
    const uploadDir = path.join(__dirname, '../uploads/payment-proofs');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `proof-${Date.now()}${path.extname(paymentProof.name)}`;
    const filePath = path.join(uploadDir, fileName);

    await paymentProof.mv(filePath);

    // Create deposit record
    const deposit = new Deposit({
      userId,
      paymentMethodId,
      amount,
      currency,
      paymentProof: `/payment-proofs/${fileName}`,
      transactionReference: `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      metadata: {
        paymentMethodDetails: paymentMethod.details
      }
    });

    await deposit.save();

    // In a real application, you might want to:
    // 1. Notify admin about new deposit
    // 2. Send confirmation email to user
    // 3. Initiate any automatic verification processes

    res.status(201).json({ 
      success: true, 
      message: 'Deposit request submitted successfully',
      data: {
        depositId: deposit._id,
        reference: deposit.transactionReference,
        status: deposit.status,
        paymentMethod: paymentMethod.title,
        amount,
        currency
      }
    });

  } catch (err) {
    console.error('Deposit creation error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create deposit',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get user's deposit history
export const getDepositHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user._id };
    if (status) query.status = status;

    const [deposits, total] = await Promise.all([
      Deposit.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Deposit.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        deposits,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          limit
        }
      }
    });
  } catch (err) {
    console.error('Deposit history error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch deposit history' 
    });
  }
};