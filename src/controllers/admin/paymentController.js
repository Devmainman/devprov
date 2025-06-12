import PaymentMethod from '../../models/PaymentMethod.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const formatError = (err) => ({
  message: err.message || 'An error occurred',
  details: process.env.NODE_ENV === 'development' ? err.stack : undefined
});

// Get all payment methods for admin
export const getPaymentMethods = async (req, res) => {
  try {
    const methods = await PaymentMethod.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: methods });
  } catch (err) {
    console.error('Admin payment methods error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch payment methods',
      error: formatError(err) 
    });
  }
};

// Create new payment method
export const createPaymentMethod = async (req, res) => {
  try {
    console.log('Create Request - Content-Type:', req.get('Content-Type'));
    console.log('Create Request - Body:', req.body);
    console.log('Create Request - Files:', req.files);

    const { methodId, title, details, isActive, instructions, minAmount, maxAmount, processingTime } = req.body;

    // Validate required fields
    if (!methodId || !title) {
      return res.status(400).json({ 
        success: false, 
        message: 'Method ID and title are required' 
      });
    }

    // Check if method already exists
    const existingMethod = await PaymentMethod.findOne({ methodId });
    if (existingMethod) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment method with this ID already exists' 
      });
    }

    // Parse details if it's a string
    let parsedDetails = details;
    if (typeof details === 'string' && details) {
      try {
        parsedDetails = JSON.parse(details);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid details format' 
        });
      }
    }

    let iconPath = '';
    if (req.files?.icon) {
      const icon = req.files.icon;
      const fileExt = path.extname(icon.name).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.svg'].includes(fileExt)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Icon must be a PNG, JPG, JPEG, or SVG file' 
        });
      }
      const fileName = `icon-${Date.now()}${fileExt}`;
      const uploadPath = path.join(__dirname, '../../Uploads/icons', fileName);
      await icon.mv(uploadPath);
      iconPath = `/icons/${fileName}`;
    }

    const newMethod = new PaymentMethod({
      methodId,
      title,
      icon: iconPath,
      details: parsedDetails || [],
      isActive: isActive === 'true' || isActive === true,
      instructions,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      processingTime
    });

    await newMethod.save();

    return res.status(201).json({ 
      success: true, 
      message: 'Payment method created successfully',
      data: newMethod 
    });
  } catch (err) {
    console.error('Create payment method error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create payment method',
      error: formatError(err) 
    });
  }
};

// Update payment method
export const updatePaymentMethod = async (req, res) => {
  try {
    console.log('Update Request - Content-Type:', req.get('Content-Type'));
    console.log('Update Request - Body:', req.body);
    console.log('Update Request - Files:', req.files);
    console.log('Update Request - Params:', req.params);

    const { id } = req.params;
    let { title, details, isActive, instructions, minAmount, maxAmount, processingTime } = req.body;

    // Find existing payment method
    const method = await PaymentMethod.findById(id);
    if (!method) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment method not found' 
      });
    }

    // Parse details if it's a string
    let parsedDetails = details;
    if (typeof details === 'string' && details) {
      try {
        parsedDetails = JSON.parse(details);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid details format' 
        });
      }
    }

    // Handle icon update
    let iconPath = method.icon;
    if (req.files?.icon) {
      const icon = req.files.icon;
      const fileExt = path.extname(icon.name).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.svg'].includes(fileExt)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Icon must be a PNG, JPG, JPEG, or SVG file' 
        });
      }
      // Delete old icon file if it exists
      if (method.icon) {
        const oldIconPath = path.join(__dirname, '../../Uploads', method.icon);
        if (fs.existsSync(oldIconPath)) {
          fs.unlinkSync(oldIconPath);
        }
      }
      // Save new icon
      const fileName = `icon-${Date.now()}${fileExt}`;
      const uploadPath = path.join(__dirname, '../../Uploads/icons', fileName);
      await icon.mv(uploadPath);
      iconPath = `/icons/${fileName}`;
    }

    // Update fields
    const updateData = {
      title: title || method.title,
      icon: iconPath,
      details: parsedDetails || method.details,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : method.isActive,
      instructions: instructions || method.instructions,
      minAmount: minAmount ? parseFloat(minAmount) : method.minAmount,
      maxAmount: maxAmount ? parseFloat(maxAmount) : method.maxAmount,
      processingTime: processingTime || method.processingTime,
      updatedAt: Date.now()
    };

    const updatedMethod = await PaymentMethod.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    return res.json({ 
      success: true, 
      message: 'Payment method updated successfully',
      data: updatedMethod 
    });
  } catch (err) {
    console.error('Update payment method error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update payment method',
      error: formatError(err) 
    });
  }
};

// Delete payment method
export const deletePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;

    const method = await PaymentMethod.findById(id);
    if (!method) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment method not found' 
      });
    }

    // Delete icon file if it exists
    if (method.icon) {
      const iconPath = path.join(__dirname, '../../Uploads', method.icon);
      if (fs.existsSync(iconPath)) {
        fs.unlinkSync(iconPath);
      }
    }

    await PaymentMethod.findByIdAndDelete(id);

    return res.json({ 
      success: true, 
      message: 'Payment method deleted successfully' 
    });
  } catch (err) {
    console.error('Delete payment method error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to delete payment method',
      error: formatError(err) 
    });
  }
};

// Toggle payment method status
export const togglePaymentMethodStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const method = await PaymentMethod.findById(id);
    if (!method) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment method not found' 
      });
    }

    method.isActive = !method.isActive;
    await method.save();

    return res.json({ 
      success: true, 
      message: `Payment method ${method.isActive ? 'activated' : 'deactivated'}`,
      data: method 
    });
  } catch (err) {
    console.error('Toggle status error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to toggle payment method status',
      error: formatError(err) 
    });
  }
};