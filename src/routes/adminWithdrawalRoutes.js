import express from 'express';
import Withdrawal from '../models/Withdrawal.js';
import { authenticate } from '../middleware/auth.js';
import { sendNotification } from '../app.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.use(authenticate); // Ensure admin authentication

// Get all withdrawals for admin
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { 'user.accountId': { $regex: search, $options: 'i' } },
        { 'user.firstName': { $regex: search, $options: 'i' } },
        { 'user.lastName': { $regex: search, $options: 'i' } }
      ];
    }
    const withdrawals = await Withdrawal.find(query)
      .populate('method', 'title methodId icon')
      .populate('user', 'accountId firstName lastName currency')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    const total = await Withdrawal.countDocuments(query);
    res.json({ withdrawals, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Fetch withdrawals error:', err);
    res.status(500).json({ message: 'Error fetching withdrawals' });
  }
});

// Update withdrawal status
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!['pending', 'processing', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    withdrawal.status = status;
    if (adminNotes) withdrawal.adminNotes = adminNotes;
    await withdrawal.save();

    // Notify user via WebSocket
    sendNotification(withdrawal.user.toString(), {
      type: 'withdrawal_update',
      withdrawalId: withdrawal._id,
      status,
      message: `Your withdrawal of ${withdrawal.amount} has been ${status}.`
    });

    // If rejected, refund the user's balance
    if (status === 'rejected') {
      const user = await User.findById(withdrawal.user);
      user.balance += withdrawal.amount;
      await user.save();
    }

    res.json(withdrawal);
  } catch (err) {
    console.error('Update withdrawal error:', err);
    res.status(500).json({ message: 'Error updating withdrawal' });
  }
});

// Delete withdrawal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    await withdrawal.deleteOne();
    res.json({ message: 'Withdrawal deleted' });
  } catch (err) {
    console.error('Delete withdrawal error:', err);
    res.status(500).json({ message: 'Error deleting withdrawal' });
  }
});

// Upload receipt for withdrawal
router.post('/:id/receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    // Check if file was uploaded
    if (!req.files || !req.files.receipt) {
      return res.status(400).json({ message: 'No receipt file uploaded' });
    }

    const receiptFile = req.files.receipt;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(receiptFile.mimetype)) {
      return res.status(400).json({ message: 'Only JPEG, PNG, or GIF files are allowed' });
    }

    // Generate unique filename
    const fileName = `${id}_${Date.now()}${path.extname(receiptFile.name)}`;
    const uploadPath = path.join(__dirname, '../../Uploads', fileName);

    // Move file to uploads directory
    await receiptFile.mv(uploadPath);

    // Update withdrawal with receipt path
    withdrawal.receipt = `/Uploads/${fileName}`;
    await withdrawal.save();

    // Notify user via WebSocket
    sendNotification(withdrawal.user.toString(), {
      type: 'withdrawal_receipt',
      withdrawalId: withdrawal._id,
      message: 'A receipt has been uploaded for your withdrawal.'
    });

    res.json({ message: 'Receipt uploaded successfully', receipt: withdrawal.receipt });
  } catch (err) {
    console.error('Upload receipt error:', err);
    res.status(500).json({ message: 'Error uploading receipt' });
  }
});

export default router;