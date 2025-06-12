import Admin from '../models/Admin.js';
import Assignment from '../models/Assignment.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js'; 


// Admin Login
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: 'Invalid admin credentials' });

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid admin credentials' });

    const token = jwt.sign(
      {
        id: admin._id,
        isAdmin: true,  // MUST be included
        role: 'admin',  // Recommended for clarity
        // Add these for better debugging:
        iss: 'your-app-name',
        aud: 'your-app-client'
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '8h',
        algorithm: 'HS256' // Explicitly specify algorithm
      }
    );

    res.json({ token, role: 'admin' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create Admin (One-time use)
export const createAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Password will auto-hash from Admin model's pre-save hook
    const admin = new Admin({ email, password });
    await admin.save();
    res.status(201).json({ message: 'Admin created', email });
  } catch (err) {
    res.status(400).json({ message: 'Error creating admin' });
  }
};

// Add this new controller function
export const verifyAdmin = async (req, res) => {
  try {
    // The authenticate middleware already verified the token
    const admin = await Admin.findById(req.user.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    res.json({
      success: true,
      admin: {
        id: admin._id,
        email: admin.email,
        role: 'admin',
        isAdmin: true
      }
    });
  } catch (err) {
    console.error('Verify Admin Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Admin verification failed' 
    });
  }
};

export const getUsers = async (req, res) => {
  console.log('Attempting to fetch users...'); // Add this line
  try {
    console.log('Checking database connection...');
    if (!mongoose.connection.readyState) {
      throw new Error('Database not connected');
    }

    console.log('Querying users...');
    const users = await User.find()
      .select('_id accountId fullName email')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${users.length} users`); // Add this line
    res.json(users);
  } catch (err) {
    console.error('Detailed error:', {
      message: err.message,
      stack: err.stack,
      mongooseState: mongoose.connection.readyState
    });
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update User
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Validate the ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent updating sensitive fields directly
    const restrictedFields = ['password', 'accountId', 'joinedDate', '_id', 'createdAt', 'updatedAt'];
    for (const field of restrictedFields) {
      if (updates[field]) {
        return res.status(400).json({ 
          message: `Cannot update restricted field: ${field}` 
        });
      }
    }

    // Handle password update separately (if needed)
    if (updates.newPassword) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(updates.newPassword, salt);
      await user.save();
      delete updates.newPassword;
    }

    // Update other fields
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        // Handle nested objects (like address, verification)
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          if (user[parent]) {
            user[parent][child] = value;
          }
        } else {
          user[key] = value;
        }
      }
    }

    // Save the updated user
    const updatedUser = await user.save();

    // Return the updated user (excluding sensitive fields)
    const userToReturn = updatedUser.toObject();
    delete userToReturn.password;
    delete userToReturn.otp;
    delete userToReturn.verification.identityDocuments; // if sensitive

    res.json({
      success: true,
      user: userToReturn,
      message: 'User updated successfully'
    });

  } catch (err) {
    console.error('Update User Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

