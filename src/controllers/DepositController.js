import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';


// Create new deposit (user)
export const createDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { paymentMethodId, amount, currency = 'NGN' } = req.body;
    const userId = req.user.id;

    if (!paymentMethodId || !amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Payment method and amount are required'
      });
    }

    // Handle file upload
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
    const uploadPath = path.join(__dirname, '../uploads/paymentproof', fileName);

    await paymentProof.mv(uploadPath);

    const transactionReference = `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const deposit = new Deposit({
      userId,
      paymentMethodId,
      amount: parseFloat(amount),
      currency,
      paymentProof: `/paymentproof/${fileName}`,
      transactionReference,
      status: 'pending'
    });

    await deposit.save({ session });

    await Transaction.create([{
      userId,
      amount: parseFloat(amount),
      currency,
      type: 'deposit',
      status: 'pending',
      reference: transactionReference
    }], { session });

    await session.commitTransaction();
    session.endSession();

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

// Get user's deposits
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
      receipt: d.paymentProof || ''
    }));

    res.json({
      success: true,
      data: formattedDeposits,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        limit
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


// Get all deposits (admin)
export const getDeposits = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { paymentMethod: new RegExp(search, 'i') },
        { transactionReference: new RegExp(search, 'i') },
        { 'user.accountId': new RegExp(search, 'i') },
        { 'user.fullName': new RegExp(search, 'i') }
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

    // Format response to match frontend structure
    const formattedDeposits = deposits.map(d => ({
      id: d._id,
      date: d.createdAt,
      accountId: d.userId.accountId,
      fullName: `${d.userId.firstName} ${d.userId.lastName}`,
      paymentMethod: d.paymentMethodId?.title || 'Bank Transfer',
      icon: d.paymentMethodId?.icon || '💷Bank Trans',
      amount: d.amount.toLocaleString('en-US') + ' ' + d.currency,
      status: d.status,
      receipt: d.paymentProof || '',
      proofUrl: d.paymentProof || '',
      reason: d.adminNotes || ''
    }));

    res.json({
      success: true,
      data: formattedDeposits,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        limit
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

// Update deposit status (admin)
export const updateDepositStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const adminId = req.admin.id;

    // Validate status
    if (!['approved', 'rejected', 'processing'].includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Invalid status' 
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

    // If changing to approved
    if (status === 'approved' && deposit.status !== 'approved') {
      // Add to user balance
      await User.findByIdAndUpdate(
        deposit.userId, 
        { $inc: { balance: deposit.amount } },
        { session }
      );

      // Create transaction record
      await Transaction.create([{
        userId: deposit.userId,
        amount: deposit.amount,
        type: 'deposit',
        status: 'completed',
        reference: deposit.transactionReference,
        currency: deposit.currency
      }], { session });
    }

    // If changing from approved to rejected
    if (status === 'rejected' && deposit.status === 'approved') {
      // Deduct from user balance
      await User.findByIdAndUpdate(
        deposit.userId, 
        { $inc: { balance: -deposit.amount } },
        { session }
      );
    }

    // Update deposit
    deposit.status = status;
    deposit.adminNotes = adminNotes;
    deposit.processedBy = adminId;
    deposit.processedAt = new Date();
    await deposit.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Deposit status updated'
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update deposit error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update deposit' 
    });
  }
};

// Delete deposit (admin)
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