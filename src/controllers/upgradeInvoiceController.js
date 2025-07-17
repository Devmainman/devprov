import UpgradeInvoice from '../models/UpgradeInvoice.js';
import User from '../models/User.js';
import Package from '../models/Package.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import Transaction from '../models/Transaction.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create new upgrade invoice
export const createUpgradeInvoice = async (req, res) => {
  try {
    const { paymentMethod, amount, currency } = req.body;

    if (!req.files?.paymentProof || !paymentMethod || !amount || !currency) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields or payment proof'
      });
    }

    const user = await User.findById(req.user.id).populate('pendingPackage');
    if (!user || !user.pendingPackage) {
      return res.status(404).json({
        success: false,
        message: 'User or pending package not found'
      });
    }

    const paymentProof = req.files.paymentProof;
    const uploadDir = path.join(__dirname, '../uploads/invoices');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `payment-proof-${uniqueSuffix}${path.extname(paymentProof.name)}`;
    const filePath = path.join(uploadDir, fileName);
    await paymentProof.mv(filePath);

    const transactionReference = `UPG-${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    const upgradeInvoice = new UpgradeInvoice({
      user: user._id,
      userSnapshot: {
        accountId: user.accountId,
        fullName: user.fullName,
        email: user.email
      },
      package: user.pendingPackage._id,
      packageSnapshot: {
        name: user.pendingPackage.name,
        amount: user.pendingPackage.amount,
        currency: user.pendingPackage.currency
      },
      paymentMethod,
      amount,
      currency,
      paymentProof: `/uploads/invoices/${fileName}`,
      receipt: '',
      transactionReference
    });

    await upgradeInvoice.save();

    const transaction = new Transaction({
      userId: user._id,
      amount,
      currency,
      type: 'upgrade',
      status: 'pending',
      reference: transactionReference,
      metadata: {
        package: user.pendingPackage.name,
        method: paymentMethod
      }
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      invoice: upgradeInvoice
    });

  } catch (err) {
    console.error('Create upgrade invoice error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error creating upgrade invoice'
    });
  }
};


// Get all upgrade invoices (admin)
export const getUpgradeInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    
    if (search) {
      query.$or = [
      { 'userSnapshot.accountId': { $regex: search, $options: 'i' } },
      { 'userSnapshot.fullName': { $regex: search, $options: 'i' } },
      { 'packageSnapshot.name': { $regex: search, $options: 'i' } },
      { status: { $regex: search, $options: 'i' } }
    ];
    }

    const invoices = await UpgradeInvoice.find(query)
      .populate('user', 'accountId fullName')
      .populate('package', 'name amount currency')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await UpgradeInvoice.countDocuments(query);

    // Format for frontend
   const formattedInvoices = invoices.map(invoice => ({
      id: invoice._id,
      date: invoice.createdAt,
      package: invoice.package?.name || '[Missing Package]',
      accountId: invoice.user?.accountId || '[Deleted User]',
      fullName: invoice.user?.fullName || '[Deleted User]',
      paymentMethod: invoice.paymentMethod,
      amount: `${invoice.amount} ${invoice.currency}`,
      status: invoice.status,
      paymentProof: invoice.paymentProof,
      receipt: invoice.receipt || '',
      disputed: invoice.status === 'disputed',
      disputeReason: invoice.disputeReason || ''
    }));


    res.json({
      success: true,
      invoices: formattedInvoices,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Get upgrade invoices error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching upgrade invoices'
    });
  }
};

// Update upgrade invoice status (admin)
export const updateUpgradeInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, disputeReason } = req.body;

    const upgradeInvoice = await UpgradeInvoice.findById(id);
    
    if (!upgradeInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Upgrade invoice not found'
      });
    }

    // Handle different actions
    switch (action) {
      case 'approve':
        upgradeInvoice.status = 'approved';

        const user = await User.findById(upgradeInvoice.user);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found during upgrade'
          });
        }

        const pkg = await Package.findById(upgradeInvoice.package);
        if (!pkg) {
          return res.status(404).json({
            success: false,
            message: 'Package not found during upgrade'
          });
        }

        user.accountType = pkg.name; // or save package ID, if preferred
        user.pendingPackage = null;  // clear pending state
        await user.save();

        break;

        
      case 'reject':
        upgradeInvoice.status = 'rejected';
        break;
        
      case 'dispute':
        if (!disputeReason) {
          return res.status(400).json({
            success: false,
            message: 'Dispute reason is required'
          });
        }
        upgradeInvoice.status = 'disputed';
        upgradeInvoice.disputeReason = disputeReason;
        break;
        
      case 'resolve-approve':
        if (upgradeInvoice.status !== 'disputed') {
          return res.status(400).json({
            success: false,
            message: 'Invoice is not in disputed state'
          });
        }
        upgradeInvoice.status = 'approved';
        upgradeInvoice.disputeReason = '';
        
        // Update user package when approved after dispute
        await User.findByIdAndUpdate(upgradeInvoice.user, {
          package: upgradeInvoice.package,
          accountLevel: 'Premium'
        });
        break;
        
      case 'resolve-reject':
        if (upgradeInvoice.status !== 'disputed') {
          return res.status(400).json({
            success: false,
            message: 'Invoice is not in disputed state'
          });
        }
        upgradeInvoice.status = 'rejected';
        upgradeInvoice.disputeReason = '';
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    await upgradeInvoice.save();

    res.json({
      success: true,
      invoice: upgradeInvoice
    });
  } catch (err) {
    console.error('Update upgrade invoice status error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating upgrade invoice'
    });
  }
};

// Delete upgrade invoice (admin)
export const deleteUpgradeInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const upgradeInvoice = await UpgradeInvoice.findByIdAndDelete(id);
    
    if (!upgradeInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Upgrade invoice not found'
      });
    }
    
    // Delete associated file
    if (upgradeInvoice.paymentProof) {
      const filePath = path.join(__dirname, `../${upgradeInvoice.paymentProof}`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.json({
      success: true,
      message: 'Upgrade invoice deleted successfully'
    });
  } catch (err) {
    console.error('Delete upgrade invoice error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error deleting upgrade invoice'
    });
  }
};