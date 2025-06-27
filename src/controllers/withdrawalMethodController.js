import Currency from '../models/Currency.js';
import WithdrawalMethod from '../models/WithdrawalMethod.js';
import User from '../models/User.js';
import Setting from '../models/Setting.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure Uploads/icons directory exists
const ensureIconsDirectory = () => {
  const iconsDir = path.join(__dirname, '..', 'Uploads', 'icons');
  try {
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
      console.log('Created icons directory:', iconsDir);
    }
  } catch (err) {
    console.error('Failed to create icons directory:', err);
    throw new Error(`Directory creation failed: ${err.message}`);
  }
  return iconsDir;
};

const getDefaultCurrency = async () => {
  const setting = await Setting.findOne().lean();
  return setting?.defaultCurrency || 'USD'; // Fallback if not set
};


// Get all withdrawal methods (admin)
export const getWithdrawalMethods = async (req, res) => {
  console.log('getWithdrawalMethods Controller Hit');
  try {
    const methods = await WithdrawalMethod.find().sort({ createdAt: -1 }).lean();
    console.log('Fetched Methods:', methods.length);
    res.json({ success: true, data: methods });
  } catch (err) {
    console.error('Get withdrawal methods error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching withdrawal methods',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

// Get active withdrawal methods (public)

export const getActiveWithdrawalMethods = async (req, res) => {
  try {
    const defaultCurrencyCode = await getDefaultCurrency();

    // ✅ Fetch user to get currency
    const user = await User.findById(req.user.id).select('currency').lean();
    if (!user || !user.currency) {
      return res.status(400).json({
        success: false,
        message: 'User currency not found in database.',
      });
    }

    const userCurrencyCode = user.currency;

    const [defaultCurrency, userCurrency] = await Promise.all([
      Currency.findOne({ code: defaultCurrencyCode }).lean(),
      Currency.findOne({ code: userCurrencyCode }).lean()
    ]);

    if (!defaultCurrency || !userCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Invalid currency configuration.',
      });
    }

    const conversionRate = userCurrency.rate / defaultCurrency.rate;

    const methods = await WithdrawalMethod.find({ isActive: true })
      .select('_id methodId title icon isActive details minAmount maxAmount currency')
      .sort({ createdAt: -1 })
      .lean();

    const convertedMethods = methods.map(method => ({
      ...method,
      currency: userCurrency.code,
      minAmount: parseFloat((method.minAmount * conversionRate).toFixed(2)),
      maxAmount: parseFloat((method.maxAmount * conversionRate).toFixed(2)),
    }));

    res.json({ success: true, data: convertedMethods });
  } catch (err) {
    console.error('getActiveWithdrawalMethods error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to load active withdrawal methods.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};


// Create new withdrawal method
export const createWithdrawalMethod = async (req, res) => {
  console.log('Create Request - Body:', req.body);
  console.log('Create Request - Files:', req.files);
  try {
    const { title, isActive, details, methodId, minAmount, maxAmount, requiredSignal } = req.body;
    let iconPath = '';

    if (!title || !methodId) {
      return res.status(400).json({
        success: false,
        message: 'Title and method ID are required',
      });
    }
    

    const parsedMin = parseFloat(minAmount);
    const parsedMax = parseFloat(maxAmount);

    // Validation for min/max
    if (isNaN(parsedMin) || isNaN(parsedMax)) {
      return res.status(400).json({
        success: false,
        message: 'Min and Max amount must be valid numbers',
      });
    }
    if (parsedMin > parsedMax) {
      return res.status(400).json({
        success: false,
        message: 'Minimum amount cannot be greater than maximum amount',
      });
    }

    if (req.files?.icon) {
      const icon = req.files.icon;
      const timestamp = Date.now();
      const fileName = `icon-${timestamp}${path.extname(icon.name)}`;
      const iconsDir = ensureIconsDirectory();
      const uploadPath = path.join(iconsDir, fileName);

      console.log('Attempting to save icon to:', uploadPath);
      await icon.mv(uploadPath);
      iconPath = `/icons/${fileName}`;
      console.log('Icon uploaded:', iconPath);
    }

    const parsedDetails = details ? JSON.parse(details) : [];
    const currency = await getDefaultCurrency(); // get currency from settings
    const newMethod = new WithdrawalMethod({
      methodId,
      title,
      isActive: isActive === 'true' || isActive === true,
      details: parsedDetails,
      icon: iconPath,
      minAmount: parsedMin,
      maxAmount: parsedMax,
      requiredSignal: parseInt(requiredSignal) || 100,
      currency,
    });

    await newMethod.save();
    console.log('Created Method:', newMethod._id);
    res.status(201).json({ success: true, data: newMethod });
  } catch (err) {
    console.error('Create withdrawal method error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating withdrawal method',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

// Update withdrawal method
export const updateWithdrawalMethod = async (req, res) => {
  console.log('Update Request - Content-Type:', req.headers['content-type']);
  console.log('Update Request - Body:', req.body);
  console.log('Update Request - Files:', req.files);

  try {
    const { title, isActive, details, minAmount, maxAmount, requiredSignal } = req.body;
    const method = await WithdrawalMethod.findById(req.params.id);

    if (!method) {
      return res.status(404).json({ success: false, message: 'Withdrawal method not found' });
    }

    // Validate min and max amounts if provided
    const parsedMin = minAmount !== undefined ? parseFloat(minAmount) : undefined;
    const parsedMax = maxAmount !== undefined ? parseFloat(maxAmount) : undefined;

    if (!isNaN(parsedMin) && !isNaN(parsedMax) && parsedMin > parsedMax) {
      return res.status(400).json({
        success: false,
        message: 'Minimum amount cannot be greater than maximum amount',
      });
    }

    // Handle icon upload
    let iconPath = method.icon;
    if (req.files?.icon) {
      const icon = req.files.icon;
      const timestamp = Date.now();
      const fileName = `icon-${timestamp}${path.extname(icon.name)}`;
      const iconsDir = ensureIconsDirectory();
      const uploadPath = path.join(iconsDir, fileName);

      console.log('Attempting to save icon to:', uploadPath);

      // Delete old icon if exists
      if (method.icon) {
        const oldIconPath = path.join(__dirname, '..', 'Uploads', method.icon);
        if (fs.existsSync(oldIconPath)) {
          fs.unlinkSync(oldIconPath);
          console.log('Deleted old icon:', method.icon);
        }
      }

      await icon.mv(uploadPath);
      iconPath = `/icons/${fileName}`;
      console.log('New icon uploaded:', iconPath);
    }

    // Apply updates safely
    if (title !== undefined) method.title = title;
    if (isActive !== undefined) method.isActive = (isActive === 'true' || isActive === true);
    if (details !== undefined) {
      method.details = typeof details === 'string' ? JSON.parse(details) : details;
    }
    if (!isNaN(parsedMin)) method.minAmount = parsedMin;
    if (!isNaN(parsedMax)) method.maxAmount = parsedMax;
    if (!isNaN(parseInt(requiredSignal))) method.requiredSignal = parseInt(requiredSignal);
    method.icon = iconPath;

    if (!method.currency) {
      method.currency = await getDefaultCurrency(); // fallback if it wasn't set before
    }

    await method.save();
    console.log('Updated Method:', method._id);
    res.json({ success: true, data: method });

  } catch (err) {
    console.error('Update withdrawal method error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Error updating withdrawal method',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};


// Toggle withdrawal method status
export const toggleMethodStatus = async (req, res) => {
  console.log('Toggle Status Request - ID:', req.params.id);
  try {
    const method = await WithdrawalMethod.findById(req.params.id);
    if (!method) {
      return res.status(404).json({ success: false, message: 'Withdrawal method not found' });
    }

    method.isActive = req.body.isActive !== undefined ? req.body.isActive : !method.isActive;
    await method.save();
    console.log('Toggled Status:', method._id, 'isActive:', method.isActive);
    res.json({ success: true, data: method });
  } catch (err) {
    console.error('Toggle status error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error toggling status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

// Delete withdrawal method
export const deleteWithdrawalMethod = async (req, res) => {
  console.log('Delete Request - ID:', req.params.id);
  try {
    const method = await WithdrawalMethod.findById(req.params.id);
    console.log('Method Found:', method ? method._id : 'Not found');

    if (!method) {
      return res.status(404).json({ success: false, message: 'Withdrawal method not found' });
    }

    if (method.icon) {
      try {
        const iconPath = path.join(__dirname, '..', 'Uploads', method.icon);
        console.log('Checking icon path:', iconPath);
        if (fs.existsSync(iconPath)) {
          fs.unlinkSync(iconPath);
          console.log('Deleted icon:', method.icon);
        } else {
          console.log('Icon file not found:', iconPath);
        }
      } catch (unlinkErr) {
        console.error('Failed to delete icon:', unlinkErr.message);
      }
    }

    await method.deleteOne();
    console.log('Deleted Method:', req.params.id);
    res.json({ success: true, message: 'Withdrawal method deleted' });
  } catch (err) {
    console.error('Delete withdrawal method error:', err.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting withdrawal method',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};