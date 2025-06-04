import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Assignment from '../models/Assignment.js';

export const getDashboardStats = async (req, res) => {
  try {
    // Get counts in parallel for better performance
    const [totalUsers, activeUsers, inactiveUsers, totalBalance] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'Active' }),
      User.countDocuments({ status: 'Inactive' }),
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$walletBalance' } } }
      ])
    ]);

    // Get recent transactions
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'fullName accountId');

    // Get pending assignments
    const pendingAssignments = await Assignment.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalBalance: totalBalance[0]?.total || 0,
        pendingAssignments,
        recentTransactions
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard stats'
    });
  }
};

export const getUserGrowth = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    let days;
    
    switch (period) {
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      default: days = 30;
    }

    const date = new Date();
    date.setDate(date.getDate() - days);

    const data = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: date }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      growth: data
    });
  } catch (err) {
    console.error('User growth error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user growth'
    });
  }
};