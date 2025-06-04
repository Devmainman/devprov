// In transactionController.js
export const getTransactions = async (req, res) => {
    try {
      const { search = '' } = req.query;
      const query = { userId: req.user.id };
  
      if (search) {
        query.$or = [
          { bankName: new RegExp(search, 'i') },
          { accountName: new RegExp(search, 'i') },
          { reference: new RegExp(search, 'i') },
          { type: new RegExp(search, 'i') }
        ];
      }
  
      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .limit(20);
  
      res.json({
        success: true,
        transactions: transactions.map(t => ({
          id: t._id,
          bankName: t.bankName,
          accountName: t.accountName,
          accountNumber: t.accountNumber,
          amount: t.amount,
          currency: t.currency,
          type: t.type,
          status: t.status,
          reference: t.reference,
          createdAt: t.createdAt
        }))
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  };

  export const createDeposit = async (req, res) => {
    try {
      const { amount, bankName, accountNumber, reference } = req.body;
      const userId = req.user._id;
  
      // Validate input
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'A valid deposit amount is required'
        });
      }
  
      // Create deposit transaction
      const deposit = new Transaction({
        userId,
        amount,
        type: 'deposit',
        status: 'completed', // Auto-complete deposits
        bankName,
        accountNumber,
        reference: reference || `DEP-${Date.now()}`,
        currency: 'NGN'
      });
  
      await deposit.save();
  
      // Update user's balance (if you're maintaining a separate balance field)
      await User.findByIdAndUpdate(userId, {
        $inc: { balance: amount }
      });
  
      res.status(201).json({
        success: true,
        message: 'Deposit successful',
        data: {
          newBalance: deposit.amount,
          reference: deposit.reference
        }
      });
  
    } catch (err) {
      console.error('Deposit error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to process deposit'
      });
    }
  };

  export const getAllTransactions = async (req, res) => {
    try {
      const { page = 1, limit = 20, type, status, userId } = req.query;
      
      const query = {};
      if (type) query.type = type;
      if (status) query.status = status;
      if (userId) query.userId = userId;
      
      const transactions = await Transaction.find(query)
        .populate('userId', 'fullName accountId email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      const total = await Transaction.countDocuments(query);
      
      res.json({
        success: true,
        transactions,
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      });
    } catch (err) {
      console.error('Get all transactions error:', err);
      res.status(500).json({
        success: false,
        message: 'Server error fetching transactions'
      });
    }
  };
  
  export const updateTransactionStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!['pending', 'completed', 'failed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction status'
        });
      }
      
      const transaction = await Transaction.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      ).populate('userId', 'fullName accountId');
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }
      
      // If completing a deposit, update user balance
      if (status === 'completed' && transaction.type === 'deposit') {
        await User.findByIdAndUpdate(
          transaction.userId,
          { $inc: { walletBalance: transaction.amount } }
        );
      }
      
      res.json({
        success: true,
        transaction
      });
    } catch (err) {
      console.error('Update transaction error:', err);
      res.status(500).json({
        success: false,
        message: 'Server error updating transaction'
      });
    }
  };