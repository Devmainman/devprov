import mongoose from 'mongoose';
import express from 'express';
import { authenticate, isAdmin } from '../middleware/auth.js';
import WithdrawalToken from '../models/WithdrawalToken.js';
import User from '../models/User.js';

const router = express.Router();
const { isValidObjectId } = mongoose;

// Get all tokens (with optional search query)
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { search } = req.query;

    let query = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      query = {
        $or: [
          { accountId: regex },
          { fullName: regex },
          { token: regex },
          { status: regex }
        ]
      };
    }

    const tokens = await WithdrawalToken.find(query).sort({ date: -1 });
    res.json(tokens);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching tokens' });
  }
});

// Create new token
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { accountId } = req.body;

    const user = await User.findOne({ accountId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate token
    const generateToken = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let token = '';
      for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
        if ([3, 7].includes(i)) token += '-';
      }
      return token;
    };

    const token = new WithdrawalToken({
      token: generateToken(),
      accountId: user.accountId,
      fullName: `${user.firstName} ${user.lastName}`.trim()
    });

    await token.save();
    res.status(201).json(token);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating token' });
  }
});

// Delete a token
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const tokenId = req.params.id;

    if (!tokenId || !isValidObjectId(tokenId)) {
      return res.status(400).json({ message: 'Invalid or missing token ID' });
    }

    const token = await WithdrawalToken.findByIdAndDelete(tokenId);
    if (!token) {
      return res.status(404).json({ message: 'Token not found' });
    }
    await token.deleteOne();
    res.json({ success: true, message: 'Token deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deleting token' });
  }
});

export default router;
