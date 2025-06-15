import express from 'express';
import Currency from '../../models/Currency.js';
import { authenticate, isAdmin } from '../../middleware/auth.js';

const router = express.Router();

// Get all currencies with pagination
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    const filter = {
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ]
    };

    const currencies = await Currency.find(filter)
      .sort({ code: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Currency.countDocuments(filter);

    res.json({
      currencies,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCurrencies: count
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update currency status
router.put('/:id/status', authenticate, isAdmin, async (req, res) => {
  try {
    const currency = await Currency.findById(req.params.id);
    if (!currency) return res.status(404).json({ error: 'Currency not found' });

    currency.status = currency.status === 'Enabled' ? 'Disabled' : 'Enabled';
    await currency.save();

    res.json(currency);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update currency rate
router.put('/:id/rate', authenticate, isAdmin, async (req, res) => {
  try {
    const { rate } = req.body;
    if (!rate || isNaN(rate)) {
      return res.status(400).json({ error: 'Valid rate required' });
    }

    const currency = await Currency.findById(req.params.id);
    if (!currency) return res.status(404).json({ error: 'Currency not found' });

    currency.rate = parseFloat(rate);
    await currency.save();

    res.json(currency);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Batch update status
router.put('/batch-status', authenticate, isAdmin, async (req, res) => {
  try {
    const { ids, status } = req.body;
    
    if (!ids || !ids.length || !['Enabled', 'Disabled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    await Currency.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );

    res.json({ message: 'Currencies updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;