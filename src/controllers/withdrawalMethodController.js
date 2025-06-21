import WithdrawalMethod from '../models/WithdrawalMethod.js';
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
  console.log('getActiveWithdrawalMethods Controller Hit');
  try {
    const methods = await WithdrawalMethod.find({ isActive: true })
      .select('_id methodId title icon isActive details minAmount maxAmount')
      .sort({ createdAt: -1 })
      .lean();
    console.log('Fetched Public Methods:', methods.length);
    res.json(methods);
  } catch (err) {
    console.error('Public withdrawal methods error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching active withdrawal methods',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
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
      res.status(400).json({
        success: false,
        message: error.message || 'Title and method ID are required',
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
    const newMethod = new WithdrawalMethod({
      methodId,
      title,
      isActive: isActive === 'true' || isActive === true,
      details: parsedDetails,
      icon: iconPath,
      minAmount: parseFloat(minAmount) || 0,
      maxAmount: parseFloat(maxAmount) || 10000,
      requiredSignal: parseInt(requiredSignal) || 100,
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

    let iconPath = method.icon;
    if (req.files?.icon) {
      const icon = req.files.icon;
      const timestamp = Date.now();
      const fileName = `icon-${timestamp}${path.extname(icon.name)}`;
      const iconsDir = ensureIconsDirectory();
      const uploadPath = path.join(iconsDir, fileName);

      console.log('Attempting to save icon to:', uploadPath);
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

    method.title = title || method.title;
    method.isActive = isActive !== undefined ? (isActive === 'true' || isActive === true) : method.isActive;
    method.details = details
    ? (typeof details === 'string' ? JSON.parse(details) : details)
    : method.details;
    method.icon = iconPath;
    method.minAmount = parseFloat(minAmount) || method.minAmount;
    method.maxAmount = parseFloat(maxAmount) || method.maxAmount;
    method.requiredSignal = parseInt(requiredSignal) || method.requiredSignal;

    await method.save();
    console.log('Updated Method:', method._id);
    res.json({ success: true, data: method });
  } catch (err) {
    console.error('Update withdrawal method error:', err.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating withdrawal method',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
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