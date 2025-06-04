import PaymentMethod from '../../models/PaymentMethod.js';



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
    const { methodId, title, icon, details, isActive, instructions, minAmount, maxAmount, processingTime } = req.body;

    // Validate required fields
    if (!methodId || !title || !icon) {
      return res.status(400).json({ 
        success: false, 
        message: 'Method ID, title and icon are required' 
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

    const newMethod = new PaymentMethod({
      methodId,
      title,
      icon,
      details: details || [],
      isActive: isActive !== false,
      instructions,
      minAmount,
      maxAmount,
      processingTime
    });

    await newMethod.save();

    res.status(201).json({ 
      success: true, 
      message: 'Payment method created successfully',
      data: newMethod 
    });

  } catch (err) {
    console.error('Create payment method error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create payment method',
      error: formatError(err) 
    });
  }
};

// Update payment method
export const updatePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove immutable fields if present
    delete updateData.methodId;
    delete updateData._id;
    delete updateData.createdAt;

    const method = await PaymentMethod.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!method) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment method not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Payment method updated successfully',
      data: method 
    });

  } catch (err) {
    console.error('Update payment method error:', err);
    res.status(500).json({ 
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

    const method = await PaymentMethod.findByIdAndDelete(id);
    if (!method) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment method not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Payment method deleted successfully' 
    });

  } catch (err) {
    console.error('Delete payment method error:', err);
    res.status(500).json({ 
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

    res.json({ 
      success: true, 
      message: `Payment method ${method.isActive ? 'activated' : 'deactivated'}`,
      data: method 
    });

  } catch (err) {
    console.error('Toggle status error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to toggle payment method status',
      error: formatError(err) 
    });
  }
};