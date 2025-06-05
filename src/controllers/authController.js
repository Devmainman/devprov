import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

// Generate tokens
const generateTokens = (user, isAdmin = false) => {
  const accessToken = jwt.sign(
    { 
      id: user._id, 
      isAdmin,
      role: isAdmin ? 'admin' : 'user' 
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' } // Shorter-lived access token
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' } // Longer-lived refresh token
  );

  return { accessToken, refreshToken };
};

// Admin Login
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ 
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials' 
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials' 
      });
    }

    const { accessToken, refreshToken } = generateTokens(admin, true);
    
    // Save refresh token to admin document
    admin.refreshToken = refreshToken;
    await admin.save();

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      success: true,
      token: accessToken,
      role: 'admin'
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
};

// Refresh Token
export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        code: 'NO_REFRESH_TOKEN',
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // Find user by ID and check refresh token
    let user = await Admin.findOne({ 
      _id: decoded.id, 
      refreshToken 
    });

    if (!user) {
      user = await User.findOne({ 
        _id: decoded.id, 
        refreshToken 
      });
    }

    if (!user) {
      return res.status(403).json({
        success: false,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { 
        id: user._id, 
        isAdmin: user instanceof Admin,
        role: user instanceof Admin ? 'admin' : 'user'
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ 
      success: true,
      token: newAccessToken 
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token expired'
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error during token refresh' 
    });
  }
};

// Logout
export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(204).end();
    }

    // Clear refresh token from database
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    await Promise.all([
      Admin.updateOne({ _id: decoded.id }, { $set: { refreshToken: null } }),
      User.updateOne({ _id: decoded.id }, { $set: { refreshToken: null } })
    ]);

    // Clear HTTP-only cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(204).end();
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during logout' 
    });
  }
};

export const verifyAdminAccess = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdminAccess || !decoded.userId) {
      return res.status(401).json({ success: false, message: 'Invalid admin access token' });
    }

    // Fetch user data
    const user = await User.findById(decoded.userId).select('-password -__v');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate a new session token (same format as regular login)
    const sessionToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        accountId: user.accountId,
        isVerified: true, // Treat admin access as verified
        // Add other fields needed by UserAuthContext
      },
      token: sessionToken,
      message: 'Admin access verified'
    });
  } catch (err) {
    console.error('Verify admin access error:', err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    res.status(500).json({ success: false, message: 'Server error verifying admin access' });
  }
};