import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { createTransaction } from '../services/transactionService.js';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getUserThreshold } from '../utils/getUserThreshold.js';


// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const createDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { paymentMethodId, amount } = req.body;
    const userId = req.user.id;

    // Get user with their currency
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currency = user.currency; // Always use user's currency

    if (!paymentMethodId || !amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Payment method and amount are required'
      });
    }

    // const maxThreshold = await getUserThreshold(user);

    // if (user.balance >= maxThreshold) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Your balance has reached the maximum threshold. Deposits are not allowed.'
    //   });
    // }


    if (!req.files?.paymentProof) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Payment proof is required'
      });
    }

    const paymentProof = req.files.paymentProof;
    const fileExt = path.extname(paymentProof.name);
    const fileName = `proof-${Date.now()}${fileExt}`;
    const uploadPath = path.join(__dirname, '../Uploads/payment-proofs', fileName);

    await paymentProof.mv(uploadPath);

    const transactionReference = `DEP-${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    const deposit = new Deposit({
      userId,
      paymentMethodId,
      amount: parseFloat(amount),
      currency, // Using user's currency
      paymentProof: `/Uploads/payment-proofs/${fileName}`,
      transactionReference,
      status: 'pending'
    });

    await deposit.save({ session });

    await createTransaction({
      userId,
      amount: parseFloat(amount),
      currency, // Using user's currency
      type: 'deposit',
      status: 'pending',
      reference: transactionReference
    }, { session });

    await session.commitTransaction();
    session.endSession();

    console.log('Payment proof saved at:', `/Uploads/payment-proofs/${fileName}`);

    res.status(201).json({
      success: true,
      data: deposit,
      message: 'Deposit submitted for review'
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create deposit error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create deposit',
      error: err.message
    });
  }
};

export const getUserDeposits = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = { userId: req.user.id };
    if (status) query.status = status;

    const [deposits, total] = await Promise.all([
      Deposit.find(query)
        .populate('paymentMethodId', 'title icon')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Deposit.countDocuments(query)
    ]);

    const formattedDeposits = deposits.map(d => ({
      id: d._id,
      date: d.createdAt,
      paymentMethod: d.paymentMethodId?.title || 'Unknown',
      icon: d.paymentMethodId?.icon || '💳',
      amount: d.amount.toLocaleString('en-US') + ' ' + d.currency,
      status: d.status,
      proofUrl: d.paymentProof || ''
    }));

    res.json({
      success: true,
      data: formattedDeposits,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Get user deposits error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch deposits' 
    });
  }
};

export const getDeposits = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { paymentMethodId: new RegExp(search, 'i') },
        { transactionReference: new RegExp(search, 'i') },
        { 'userId.accountId': new RegExp(search, 'i') },
        { 'userId.firstName': new RegExp(search, 'i') },
        { 'userId.lastName': new RegExp(search, 'i') }
      ];
    }

    const [deposits, total] = await Promise.all([
      Deposit.find(query)
        .populate('userId', 'accountId firstName lastName')
        .populate('paymentMethodId', 'title icon')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Deposit.countDocuments(query)
    ]);

    const formattedDeposits = deposits.map(d => ({
      id: d._id,
      date: d.createdAt,
      accountId: d.userId?.accountId || 'N/A',
      fullName: d.userId ? `${d.userId.firstName} ${d.userId.lastName}` : 'Unknown',
      paymentMethod: d.paymentMethodId?.title || 'Bank Transfer',
      icon: d.paymentMethodId?.icon || '💷',
      amount: d.amount,
      currency: d.currency,
      status: d.status,
      proofUrl: d.paymentProof || '',
      reason: d.adminNotes || ''
    }));

    res.json({
      success: true,
      data: formattedDeposits,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Get deposits error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch deposits' 
    });
  }
};

export const updateDepositStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const adminId = req.user.id;

    // Validate status input
    const validStatuses = ['approved', 'rejected', 'processing'];
    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: `Invalid status. Valid values: ${validStatuses.join(', ')}`
      });
    }

    const deposit = await Deposit.findById(id).session(session);
    if (!deposit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false,
        message: 'Deposit not found' 
      });
    }

    // Capture previous status BEFORE updating
    const previousStatus = deposit.status;
    
    // Update deposit status first
    deposit.status = status;
    deposit.adminNotes = adminNotes || '';
    deposit.processedBy = adminId;
    deposit.processedAt = new Date();
    await deposit.save({ session });

    // Handle balance updates and transaction status changes
    if (status === 'approved' && previousStatus !== 'approved') {
      // Update user balance
      const user = await User.findByIdAndUpdate(
        deposit.userId, 
        { $inc: { balance: deposit.amount } },
        { session, new: true }
      );
      
      console.log(`[DEBUG] User ${deposit.userId} balance updated:`, 
        `Previous: ${user.balance - deposit.amount}`, 
        `New: ${user.balance}`
      );

      // Update transaction status
      await Transaction.updateOne(
        { reference: deposit.transactionReference },
        { $set: { status: 'completed' } },
        { session }
      );
    }
    else if (status === 'rejected') {
      // Handle balance reversal for previously approved deposits
      if (previousStatus === 'approved') {
        const user = await User.findByIdAndUpdate(
          deposit.userId, 
          { $inc: { balance: -deposit.amount } },
          { session, new: true }
        );
        
        console.log(`[DEBUG] User ${deposit.userId} balance reversed:`, 
          `Previous: ${user.balance + deposit.amount}`, 
          `New: ${user.balance}`
        );
      }
      
      // Update transaction status to failed for all rejections
      await Transaction.updateOne(
        { reference: deposit.transactionReference },
        { $set: { status: 'failed' } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Deposit status updated successfully'
    });
    
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update deposit error:', err);
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to update deposit',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const deletePaymentProof = async (req, res) => {
  try {
    const { id } = req.params;
    const deposit = await Deposit.findById(id);

    if (!deposit) {
      return res.status(404).json({ 
        success: false, 
        message: 'Deposit not found' 
      });
    }

    if (!deposit.paymentProof) {
      return res.status(400).json({ 
        success: false, 
        message: 'No payment proof to delete' 
      });
    }

    const filePath = path.join(__dirname, '../Uploads', deposit.paymentProof);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    deposit.paymentProof = '';
    await deposit.save();

    res.json({
      success: true,
      message: 'Payment proof deleted successfully'
    });
  } catch (err) {
    console.error('Delete payment proof error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete payment proof',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const deleteDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const deposit = await Deposit.findByIdAndDelete(id);

    if (!deposit) {
      return res.status(404).json({ 
        success: false,
        message: 'Deposit not found' 
      });
    }

    if (deposit.paymentProof) {
      const filePath = path.join(__dirname, '../Uploads', deposit.paymentProof);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({
      success: true,
      message: 'Deposit deleted'
    });
  } catch (err) {
    console.error('Delete deposit error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete deposit' 
    });
  }
};