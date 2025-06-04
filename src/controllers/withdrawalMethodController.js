import WithdrawalMethod from '../models/WithdrawalMethod.js';

// Get all withdrawal methods
export const getWithdrawalMethods = async (req, res) => {
  try {
    const methods = await WithdrawalMethod.find();
    res.json(methods);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching withdrawal methods' });
  }
};

// Get active withdrawal methods (public)
export const getActiveWithdrawalMethods = async (req, res) => {
  try {
    const methods = await WithdrawalMethod.find({ isActive: true });
    res.json(methods);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching withdrawal methods' });
  }
};
// Create new withdrawal method
export const createWithdrawalMethod = async (req, res) => {
    try {
      const { title, icon, details } = req.body;
      
      // Auto-generate methodId if not provided
      const methodId = req.body.methodId || title.toLowerCase().replace(/\s+/g, '_');
      
      const method = new WithdrawalMethod({
        title,
        icon,
        methodId,
        details: details.map(d => ({ label: d.label })), // Only store labels
        minAmount: req.body.minAmount || 0,
        maxAmount: req.body.maxAmount || 10000,
        isActive: true
      });
  
      await method.save();
      res.status(201).json(method);
    } catch (err) {
      if (err.code === 11000) {
        res.status(400).json({ message: 'Method with this title already exists' });
      } else {
        console.error('Create error:', err);
        res.status(500).json({ 
          message: 'Error creating withdrawal method',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
    }
  };

// Update withdrawal method
export const updateWithdrawalMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, icon, details, minAmount, maxAmount } = req.body;

    const method = await WithdrawalMethod.findByIdAndUpdate(
      id,
      { title, icon, details, minAmount, maxAmount, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!method) {
      return res.status(404).json({ message: 'Withdrawal method not found' });
    }

    res.json(method);
  } catch (err) {
    res.status(500).json({ message: 'Error updating withdrawal method' });
  }
};

// Toggle method status
export const toggleMethodStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const method = await WithdrawalMethod.findById(id);

    if (!method) {
      return res.status(404).json({ message: 'Withdrawal method not found' });
    }

    method.isActive = !method.isActive;
    await method.save();

    res.json({ 
      message: `Method ${method.isActive ? 'activated' : 'deactivated'}`,
      isActive: method.isActive 
    });
  } catch (err) {
    res.status(500).json({ message: 'Error toggling method status' });
  }
};

// Delete withdrawal method
export const deleteWithdrawalMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const method = await WithdrawalMethod.findByIdAndDelete(id);

    if (!method) {
      return res.status(404).json({ message: 'Withdrawal method not found' });
    }

    res.json({ message: 'Withdrawal method deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting withdrawal method' });
  }
};

