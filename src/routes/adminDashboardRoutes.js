import express from 'express';
import User from '../models/User.js';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js';
import { authenticate } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

router.use(authenticate); // Ensure admin authentication

// Get dashboard stats
router.get('/stats', async (req, res) => {
    try {
      console.log('MongoDB:', mongoose.connection.readyState, 'DB:', mongoose.connection.db?.databaseName, 'Collection:', User.collection.collectionName);
      const totalUsers = await User.countDocuments({});
      console.log('Total users:', totalUsers);
      const sampleUsers = await User.find().select('email firstName accountId').limit(5).lean();
      console.log('Sample users:', sampleUsers);
  
      const stats = {
        totalUsers,
        totalCurrencies: 171,
        totalTrades: await mongoose.model('Trade')?.countDocuments() || 0,
        totalDeposits: await Deposit.countDocuments(),
        totalWithdrawals: await Withdrawal.countDocuments(),
        submittedInvoices: await mongoose.model('Invoice')?.countDocuments() || 0,
        totalReferrals: await User.countDocuments({ referredBy: { $ne: null } })
      };
      console.log('Stats response:', stats);
      res.json(stats); // Flat object
    } catch (err) {
      console.error('Stats error:', err.message);
      res.status(500).json({ message: 'Error fetching stats', error: err.message });
    }
  });

// Get recent transactions (deposits and withdrawals)
router.get('/transactions', async (req, res) => {
    try {
      const { limit = 5 } = req.query;
  
      const users = await User.find().select('transactions firstName lastName').lean();
  
      // Debug: Log users and their transactions
      console.log('Users found for transactions:', users.length);
      console.log('Sample user transactions:', users.slice(0, 5).map(u => ({
        email: u.email,
        transactions: u.transactions ? u.transactions.length : 'undefined'
      })));
  
      // Handle empty or undefined users
      if (!users || users.length === 0) {
        console.log('No users found, returning empty transactions');
        return res.json({ transactions: [] });
      }
  
      const transactions = users
        .flatMap(user => 
          (user.transactions || []).map(t => ({
            id: t.id,
            type: t.type.charAt(0).toUpperCase() + t.type.slice(1),
            fullName: `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim(),
            paymentMethod: t.reference || 'N/A',
            amount: `${t.amount || 0} ${t.currency || 'USD'}`,
            status: t.status || 'Unknown',
            createdAt: t.createdAt || new Date()
          }))
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, Number(limit));
  
      res.json({ transactions });
    } catch (err) {
      console.error('Fetch transactions error:', err.message, err.stack);
      res.status(500).json({ 
        message: 'Error fetching transactions', 
        error: process.env.NODE_ENV === 'development' ? err.message : undefined 
      });
    }
  });

// Get recent notifications
router.get('/notifications', async (req, res) => {
    try {
      const { limit = 5 } = req.query;
      const users = await User.find().select('notifications').lean();
      
      if (!users || users.length === 0) {
        return res.json({ notifications: [] });
      }
  
      const notifications = users
        .flatMap(user => user.notifications || [])
        .map(n => ({
          id: n.id,
          name: n.type.charAt(0).toUpperCase() + n.type.slice(1),
          message: n.title,
          details: n.content,
          createdAt: n.createdAt
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, Number(limit));
  
      res.json({ notifications });
    } catch (err) {
      console.error('Fetch notifications error:', err.message);
      res.status(500).json({ message: 'Error fetching notifications' });
    }
  });

export default router;