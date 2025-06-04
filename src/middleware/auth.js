import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// Enhanced error messages
const AuthError = {
  NO_TOKEN: {
    code: 'NO_TOKEN',
    message: 'Authorization token required',
    status: 401
  },
  INVALID_FORMAT: {
    code: 'INVALID_FORMAT',
    message: 'Invalid authorization format. Use: Bearer <token>',
    status: 401
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Access token expired',
    status: 401
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    message: 'Invalid access token',
    status: 401
  },
  ADMIN_REQUIRED: {
    code: 'ADMIN_REQUIRED',
    message: 'Administrator access required',
    status: 403
  }
};

export const authenticate = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  
  // No token provided
  if (!authHeader) {
    return res.status(AuthError.NO_TOKEN.status).json(AuthError.NO_TOKEN);
  }

  // Invalid token format
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(AuthError.INVALID_FORMAT.status).json(AuthError.INVALID_FORMAT);
  }

  // Extract token from header (remove 'Bearer ' prefix)
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Standardize user ID extraction
    const userId = decoded.id || decoded.userId || (decoded.user && decoded.user.id);
    
    if (!userId) {
      throw new Error('Token missing required user identification');
    }
    
    // Attach user information
    req.user = {
      id: userId,
      isAdmin: Boolean(decoded.isAdmin),
      role: decoded.role || (decoded.isAdmin ? 'admin' : 'user')
    };
    
    req.auth = req.user; // Alias for backward compatibility

    next();
  } catch (error) {
    console.error('Authentication Error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(AuthError.TOKEN_EXPIRED.status).json({
        ...AuthError.TOKEN_EXPIRED,
        expiredAt: error.expiredAt
      });
    }
    
    res.status(AuthError.INVALID_TOKEN.status).json(AuthError.INVALID_TOKEN);
  }
};

export const isAdmin = (req, res, next) => {
  if (!req.auth?.isAdmin) {
    console.error('Admin Check Failed:', {
      path: req.path,
      method: req.method,
      auth: req.auth
    });
    
    return res.status(AuthError.ADMIN_REQUIRED.status).json(AuthError.ADMIN_REQUIRED);
  }
  next();
};