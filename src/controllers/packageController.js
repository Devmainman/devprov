import Package from '../models/Package.js';
import Setting from '../models/Setting.js';
import Currency from '../models/Currency.js';
import User from '../models/User.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Configure __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const handleIconUpload = (req) => {
  if (!req.files || !req.files.icon) return '';
  
  const icon = req.files.icon;
  const uploadPath = path.join(__dirname, '../uploads/icons', icon.name);
  
  // Create the icons directory if it doesn't exist
  if (!fs.existsSync(path.join(__dirname, '../uploads/icons'))) {
    fs.mkdirSync(path.join(__dirname, '../uploads/icons'), { recursive: true });
  }

  // Move the file to the uploads directory
  icon.mv(uploadPath, (err) => {
    if (err) {
      console.error('File upload error:', err);
      return '';
    }
  });
  
  return `/uploads/icons/${icon.name}`;
};

const getDefaultCurrency = async () => {
  const setting = await Setting.findOne().lean();
  return setting?.defaultCurrency || 'USD';
};

export const createPackage = async (req, res) => {
  try {
    const { 
      name, 
      currency, 
      amount, 
      status, 
      benefits, 
      threshold, 
      requiredSignal 
    } = req.body;

    // Basic validation
    if (!name || !amount || !benefits) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, amount, and benefits are required' 
      });
    }

    // Handle file upload
    let iconPath = '';
    if (req.files?.icon) {
      const icon = req.files.icon;
      
      // Ensure the uploads directory exists
      const uploadDir = path.join(__dirname, '../uploads/icons');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Create unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = `icon-${uniqueSuffix}${path.extname(icon.name)}`;
      const uploadPath = path.join(uploadDir, filename);
      
      await icon.mv(uploadPath);
      iconPath = `/uploads/icons/${filename}`;
    }

    // Parse benefits if it's a string (from FormData)
    const parsedBenefits = typeof benefits === 'string' 
      ? JSON.parse(benefits) 
      : benefits;

    const newPackage = new Package({
      name,
      icon: iconPath,
      currency: currency || await getDefaultCurrency(),
      amount: parseFloat(amount),
      status: status || 'Active',
      benefits: Array.isArray(parsedBenefits) 
        ? parsedBenefits.filter(b => b.trim() !== '') 
        : [],
      threshold: threshold ? parseFloat(threshold) : undefined,
      requiredSignal: requiredSignal ? parseFloat(requiredSignal) : undefined
    });

    await newPackage.save();

    res.status(201).json({
      success: true,
      package: newPackage
    });
  } catch (err) {
    console.error('Create Package Error:', err);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Server error creating package' 
    });
  }
};


// Get all packages
export const getPackages = async (req, res) => {
  try {
    const packages = await Package.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      packages,
      count: packages.length
    });
  } catch (err) {
    console.error('Get Packages Error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching packages' 
    });
  }
};

export const getUserPackages = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userCurrencyCode = user.currency;
    const userCurrency = await Currency.findOne({ code: userCurrencyCode });
    if (!userCurrency) {
      return res.status(400).json({ success: false, message: 'User currency not supported' });
    }

    const packages = await Package.find({ status: 'Active' }).sort({ amount: 1 }).lean();

    const currencyRates = await Currency.find({});
    const rateMap = {};
    for (const c of currencyRates) {
      rateMap[c.code] = c.rate;
    }

    const convertedPackages = packages.map(pkg => {
      const baseRate = rateMap[pkg.currency];
      const targetRate = userCurrency.rate;
      let convertedAmount = pkg.amount;

      if (baseRate && targetRate) {
        convertedAmount = (pkg.amount * targetRate) / baseRate;
      }

      return {
        ...pkg,
        originalAmount: pkg.amount,
        originalCurrency: pkg.currency,
        amount: parseFloat(convertedAmount.toFixed(2)),
        currency: userCurrency.code
      };
    });

    res.json({ success: true, packages: convertedPackages });
  } catch (err) {
    console.error('Get User Packages Error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching packages' });
  }
};


// Update a package
export const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      currency, 
      amount, 
      status, 
      benefits, 
      threshold, 
      requiredSignal 
    } = req.body;

    // Basic validation
    if (!name || !amount || !benefits) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, amount, and benefits are required' 
      });
    }

    // Handle file upload if new icon provided
    let iconPath;
    if (req.files?.icon) {
      const icon = req.files.icon;
      
      // Ensure the uploads directory exists
      const uploadDir = path.join(__dirname, '../uploads/icons');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Create unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = `icon-${uniqueSuffix}${path.extname(icon.name)}`;
      const uploadPath = path.join(uploadDir, filename);
      
      await icon.mv(uploadPath);
      iconPath = `/uploads/icons/${filename}`;
    }

    // Parse benefits if it's a string (from FormData)
    const parsedBenefits = typeof benefits === 'string' 
      ? JSON.parse(benefits) 
      : benefits;

    const updateData = {
      name,
      currency: currency || await getDefaultCurrency(),
      amount: parseFloat(amount),
      status: status || 'Active',
      benefits: Array.isArray(parsedBenefits) 
        ? parsedBenefits.filter(b => b.trim() !== '') 
        : [],
      threshold: threshold ? parseFloat(threshold) : undefined,
      requiredSignal: requiredSignal ? parseFloat(requiredSignal) : undefined,
      updatedAt: Date.now()
    };

    // Only update icon if a new one was uploaded
    if (iconPath) {
      updateData.icon = iconPath;
    }

    const updatedPackage = await Package.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPackage) {
      return res.status(404).json({ 
        success: false,
        message: 'Package not found' 
      });
    }

    res.json({
      success: true,
      package: updatedPackage
    });
  } catch (err) {
    console.error('Update Package Error:', err);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Server error updating package' 
    });
  }
};

// Delete a package
export const deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPackage = await Package.findByIdAndDelete(id);

    if (!deletedPackage) {
      return res.status(404).json({ 
        success: false,
        message: 'Package not found' 
      });
    }

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (err) {
    console.error('Delete Package Error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error deleting package' 
    });
  }
};

// Toggle package status
export const togglePackageStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const pkg = await Package.findById(id); // Changed from 'package' to 'pkg'
    if (!pkg) {
      return res.status(404).json({ 
        success: false,
        message: 'Package not found' 
      });
    }

    pkg.status = pkg.status === 'Active' ? 'Inactive' : 'Active';
    await pkg.save();

    res.json({
      success: true,
      package: pkg
    });
  } catch (err) {
    console.error('Toggle Package Status Error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error toggling package status' 
    });
  }
};
export const getPackagesWithStats = async (req, res) => {
  try {
    const packages = await Package.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'packageId',
          as: 'users'
        }
      },
      {
        $addFields: {
          userCount: { $size: '$users' }
        }
      },
      {
        $project: {
          users: 0
        }
      },
      { $sort: { amount: 1 } }
    ]);

    res.json({
      success: true,
      packages
    });
  } catch (err) {
    console.error('Get packages with stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching package stats'
    });
  }
};

// Get users by package
export const getUsersByPackage = async (req, res) => {
  try {
    const { packageId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const users = await User.find({ packageId })
      .select('fullName email accountId status walletBalance joinedDate')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ joinedDate: -1 });
    
    const total = await User.countDocuments({ packageId });
    
    res.json({
      success: true,
      users,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Get users by package error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching package users'
    });
  }
};