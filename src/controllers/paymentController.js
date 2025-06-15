import PaymentMethod from '../models/PaymentMethod.js';
import Deposit from '../models/Deposit.js';
import PopupInvoice from '../models/PopupInvoice.js';
import Assignment from '../models/Assignment.js';
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

    const userId = req.user.id;

    if (!userId) {
      console.error('User ID missing:', req.user);
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication failed' 
      });
    }
    
    const { paymentMethodId, amount, currency, invoiceId } = req.body;

    const paymentMethod = await PaymentMethod.findOne({ methodId: paymentMethodId, isActive: true });
    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    if (paymentMethod.minAmount && amount < paymentMethod.minAmount) {
      return res.status(400).json({ success: false, message: `Minimum deposit amount is ${paymentMethod.minAmount}` });
    }

    if (paymentMethod.maxAmount && amount > paymentMethod.maxAmount) {
      return res.status(400).json({ success: false, message: `Maximum deposit amount is ${paymentMethod.maxAmount}` });
    }

    let invoice, assignment;
    if (invoiceId) {
      invoice = await PopupInvoice.findById(invoiceId);
      assignment = await Assignment.findOne({ userId, itemId: invoiceId, type: 'popup_invoice' });
      if (!invoice || !assignment || invoice.paymentStatus === 'paid') {
        return res.status(400).json({ success: false, message: 'Invalid or already paid invoice' });
      }
      if (amount !== invoice.amount || currency !== invoice.currency) {
        return res.status(400).json({ success: false, message: 'Invalid amount or currency for invoice' });
      }
    }

    if (!req.files || !req.files.paymentProof) {
      return res.status(400).json({ success: false, message: 'Payment proof is required' });
    }

    const paymentProof = req.files.paymentProof;
    const uploadDir = path.join(__dirname, '../Uploads/payment-proofs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fileName = `proof-${Date.now()}${path.extname(paymentProof.name)}`;
    const filePath = path.join(uploadDir, fileName);
    await paymentProof.mv(filePath);

    const deposit = new Deposit({
      userId,
      paymentMethodId,
      amount,
      currency,
      paymentProof: `/payment-proofs/${fileName}`,
      transactionReference: `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      metadata: {
        paymentMethodDetails: paymentMethod.details,
        invoiceId,
        assignmentId: assignment?._id,
      },
    });

    await deposit.save();

    const transaction = new Transaction({
      userId,
      amount,
      type: 'deposit',
      status: 'pending', // Matches deposit status
      currency,
      reference: deposit.transactionReference,
      metadata: {
        depositId: deposit._id,
        paymentMethodId
      }
    });
    await transaction.save();

    if (invoice) {
      await PopupInvoice.findByIdAndUpdate(invoiceId, { paymentStatus: 'pending' });
      await Assignment.findByIdAndUpdate(assignment._id, { status: 'pending_payment' });
    }

    res.status(201).json({ success: true, message: 'Deposit request submitted successfully', deposit });
  } catch (err) {
    console.error('Deposit creation error:', err);

    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${messages.join(', ')}`
      });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get user's deposit history
export const getDepositHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };
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