import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Assignment from '../models/Assignment.js';
import Package from '../models/Package.js';
import Setting from '../models/Setting.js';
import jwt from 'jsonwebtoken';
import Currency from '../models/Currency.js';

 

const transformUserForFrontend = (user) => {
    if (!user) return null;

    const formatPhone = (phone) => {
        if (!phone || phone.trim() === '') return 'Not set';
        
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('234') && cleaned.length === 12) {
            return `+${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
        }
        if (cleaned.startsWith('0') && cleaned.length === 11) {
            return `+234 ${cleaned.substring(1, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
        }
        return phone;
    };

    return {
        _id: user._id,
        accountId: user.accountId,
        email: user.email,
        fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Not set',
        country: user.country || user.address?.country || 'Not set',
        currency: user.currency || 'USD',
        accountType: user.accountType || 'Basic',
        walletBalance: typeof user.balance === 'number' ? user.balance : 0,
        mobile: user.mobile, // ADD THIS LINE
        status: user.status || 'Active',
        joinedDate: user.joinedDate,
        firstName: user.firstName,
        lastName: user.lastName,
        address: user.address,
        verification: user.verification,
        _rawMobile: (user.mobile || user.phoneNumber || '').replace(/\D/g, ''),
        tradingEnabled: user.tradingEnabled || false,
        tradingSignal: user.tradingSignal || 'hold',
        tradingSignalUpdatedAt: user.tradingSignalUpdatedAt,
        withdrawalLocked: user.withdrawalLocked || false,
        messages: user.messages || []
    };
};

const transformRequestToDB = (data) => {
    const transformed = { ...data };
    
    const phoneValue = data.phoneNumber ?? data.mobile;
    
    if (phoneValue !== undefined) {
        const cleaned = phoneValue.replace(/\D/g, ''); // remove all non-digits
    
        if (!cleaned) {
            transformed.mobile = '';
        } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
            transformed.mobile = '234' + cleaned.slice(1);
        } else if (cleaned.length === 13 && cleaned.startsWith('234')) {
            transformed.mobile = cleaned;
        } else {
            throw new Error('Invalid phone number format');
        }
    }
    
    
    delete transformed.phoneNumber;
    delete transformed._rawMobile;
    delete transformed.balance; // Prevent overwriting balance during user update

    
    return transformed;
};
// adminUserController.js
export const getSimpleUserList = async (req, res) => {
    try {
      const users = await User.find({}, 'firstName lastName accountId email');
  
      const formattedUsers = users.map(user => ({
        accountId: user.accountId,
        email: user.email,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim()
      }));
  
      res.json({ success: true, users: formattedUsers });
    } catch (error) {
      console.error('Error fetching user list:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
export const getUsers = async (req, res) => {
    try {
        const { search = '', status, page = 1, limit = 10 } = req.query;
        
        const query = {};
        
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { accountId: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status) {
            query.status = status;
        }
        
        const users = await User.find(query)
            .select('firstName lastName email mobile country currency accountId accountType balance status joinedDate address verification tradingEnabled tradingSignal tradingSignalUpdatedAt withdrawalLocked messages') // CHANGED: walletBalance → balance
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ joinedDate: -1 });
        
        const total = await User.countDocuments(query);
        
        res.json({
            success: true,
            users: users.map(transformUserForFrontend),
            total,
            page: Number(page),
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('Admin getUsers error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching users' 
        });
    }
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
  .select('firstName lastName email mobile country currency accountId accountType balance status joinedDate address verification tradingEnabled tradingSignal tradingSignalUpdatedAt withdrawalLocked messages');


        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user: transformUserForFrontend(user)
        });
    } catch (err) {
        console.error('Admin getUser error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching user' 
        });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        const updates = transformRequestToDB(req.body);
        const currentUser = await User.findById(id);

        console.log('Received update for user:', id, updates);

        if ('balance' in req.body) {
            console.warn('[SECURITY] Attempt to update balance via profile update blocked.');
            delete req.body.balance;
          }
          
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (updates.mobile !== undefined) {
            if (updates.mobile === '' || updates.mobile === 'Not set') {
                updates.mobile = '';
                updates.verification = {
                    ...currentUser.verification,
                    phoneVerified: false
                };
            }
            else if (updates.mobile !== currentUser.mobile) {
                updates.verification = {
                    ...currentUser.verification,
                    phoneVerified: false
                };
            }
        }

        if (updates.currency) {
            const currencyExists = await Currency.exists({ 
                code: updates.currency, 
                status: 'Enabled' 
            });
            
            if (!currencyExists) {
                const enabledCurrencies = await Currency.find({ status: 'Enabled' }).select('code');
                const validCurrencyCodes = enabledCurrencies.map(c => c.code);
                
                return res.status(400).json({
                    success: false,
                    message: `Invalid currency. Must be one of: ${validCurrencyCodes.join(', ')}`
                });
            }
        }
        
        const user = await User.findByIdAndUpdate(
            id, 
            updates, 
            {
                new: true,
                runValidators: true,
                context: 'query'
            }
        ).select('-password -__v -verification.identityDocuments -verification.proofOfAddress');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user: transformUserForFrontend(user),
            message: updates.mobile !== undefined && updates.mobile !== currentUser.mobile
                ? 'Mobile number updated. Verification required.'
                : 'User updated successfully'
        });
    } catch (err) {
        console.error('Admin updateUser error:', err);
        
        if (err.name === 'ValidationError') {
            const errors = {};
            Object.keys(err.errors).forEach(key => {
                errors[key] = err.errors[key].message;
            });
            
            return res.status(400).json({ 
                success: false,
                message: 'Validation error',
                errors
            });
        }
        
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number already exists in system'
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: 'Server error updating user',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};
 

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (err) {
        console.error('Admin deleteUser error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error deleting user' 
        });
    }
};

export const toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        user.status = user.status === 'Active' ? 'Inactive' : 'Active';
        await user.save();
        
        res.json({
            success: true,
            user: transformUserForFrontend(user)
        });
    } catch (err) {
        console.error('Admin toggleUserStatus error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error toggling user status' 
        });
    }
};

export const updateWalletBalance = async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, type, notes } = req.body;
      
      // Add debug logs
      console.log(`[BALANCE UPDATE START] User: ${id}, Type: ${type}, Amount: ${amount}`);
  
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid positive numeric amount is required'
        });
      }
  
      // Get current user FIRST
      const currentUser = await User.findById(id);
      if (!currentUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      console.log(`[BEFORE] Balance: ${currentUser.balance}`);
  
      // Calculate new balance
      let newBalance;
      if (type === 'credit') {
        newBalance = currentUser.balance + parsedAmount;
      } else {
        if (currentUser.balance < parsedAmount) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient funds'
          });
        }
        newBalance = currentUser.balance - parsedAmount;
      }
  
      // Update user DIRECTLY
      const updatedUser = await User.findByIdAndUpdate(
        id,
        { $inc: { balance: type === 'credit' ? parsedAmount : -parsedAmount } },
        { new: true, runValidators: true }
      );
      
  
      console.log(`[AFTER] Balance: ${updatedUser.balance}`);
  
      // Create transaction
      const transactionType = type === 'credit' ? 'admin_credit' : 'admin_debit';
      await Transaction.create({
        userId: id,
        amount: parsedAmount,
        currency: updatedUser.currency,
        type: transactionType,
        status: 'completed',
        reference: `ADJ-${Date.now()}`,
        description: notes || `${type} adjustment by admin`
      });
  
      console.log(`[TRANSACTION CREATED] Amount: ${parsedAmount}`);
  
      res.json({
        success: true,
        user: transformUserForFrontend(updatedUser),
        newBalance: newBalance
      });
    } catch (err) {
      console.error('Admin updateWalletBalance error:', err);
      
      if (err.message.includes('negative') || err.message.includes('Insufficient')) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient funds for debit operation'
        });
      }
      
      res.status(500).json({ 
        success: false,
        message: 'Server error updating wallet balance',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  };
  

export const assignPackage = async (req, res) => {
    try {
        const { userId, packageId } = req.params;
        
        const user = await User.findById(userId);
        const pkg = await Package.findById(packageId);
        
        if (!user || !pkg) {
            return res.status(404).json({
                success: false,
                message: 'User or package not found'
            });
        }
        
        user.accountType = pkg.name;
        user.packageId = pkg._id;
        await user.save();
        
        const assignment = new Assignment({
            userId: user._id,
            adminId: req.user.id,
            type: 'package',
            itemId: pkg._id,
            status: 'completed'
        });
        
        await assignment.save();
        
        res.json({
            success: true,
            user: transformUserForFrontend(user)
        });
    } catch (err) {
        console.error('Admin assignPackage error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error assigning package' 
        });
    }
};

export const resetUserPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Both new password and confirmation are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        // Set new password
        user.password = newPassword;
        await user.save();
        
        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (err) {
        console.error('Admin resetUserPassword error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error resetting password',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

export const toggleWithdrawalLock = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        user.withdrawalLocked = !user.withdrawalLocked;
        await user.save();
        
        res.json({
            success: true,
            user: transformUserForFrontend(user),
            message: `Withdrawals ${user.withdrawalLocked ? 'locked' : 'unlocked'} successfully`
        });
    } catch (err) {
        console.error('Admin toggleWithdrawalLock error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error toggling withdrawal lock' 
        });
    }
};

export const generateAdminAccess = async (req, res) => {
    try {
        const { id } = req.params; // Changed from req.params.id to req.params.id
        console.log(`Generating admin access for user ID: ${id}`);
      
      // Fetch user
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Fetch frontendURL from settings
      const settings = await Setting.findOne().select('frontendURL');
      let frontendURL = settings?.frontendURL || 'http://localhost:1200';
      
      // Ensure frontendURL is a valid URL (basic validation)
      if (!frontendURL.startsWith('http://') && !frontendURL.startsWith('https://')) {
        console.warn(`Invalid frontendURL format: ${frontendURL}, using fallback`);
        frontendURL = 'http://localhost:1200';
      }
      
      // Remove trailing slash for consistency
      frontendURL = frontendURL.replace(/\/$/, '');
      
      // Generate admin access token
      const tempToken = jwt.sign(
        { userId: user._id, isAdminAccess: true },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      // Construct dashboard URL
      const dashboardUrl = `${frontendURL}/?adminAccessToken=${tempToken}`;
      
      res.json({
        success: true,
        token: tempToken,
        redirectUrl: dashboardUrl,
        message: 'Temporary admin access granted'
      });
    } catch (err) {
      console.error('Admin generateAdminAccess error:', err);
      
      if (err.name === 'JsonWebTokenError') {
        return res.status(500).json({ 
          success: false,
          message: 'JWT configuration error' 
        });
      }
      
      res.status(500).json({ 
        success: false,
        message: 'Server error generating admin access',
        error: err.message
      });
    }
  };

export const requestEmailVerification = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (user.verification?.emailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified'
            });
        }
        
        const verificationToken = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        const response = {
            success: true,
            message: 'Email verification requested'
        };
        
        if (process.env.NODE_ENV === 'development') {
            response.verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
        }
        
        user.verification.emailVerificationToken = verificationToken;
        user.verification.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();
        
        res.json(response);
    } catch (err) {
        console.error('Admin requestEmailVerification error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error requesting email verification' 
        });
    }
};

export const requestPhoneVerification = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (!user.mobile) {
            return res.status(400).json({
                success: false,
                message: 'User has no phone number set'
            });
        }
        
        if (user.verification?.phoneVerified) {
            return res.status(400).json({
                success: false,
                message: 'Phone is already verified'
            });
        }
        
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        const response = {
            success: true,
            message: 'Phone verification requested'
        };
        
        if (process.env.NODE_ENV === 'development') {
            response.verificationCode = verificationCode;
        }
        
        user.verification.phoneVerificationCode = verificationCode;
        user.verification.phoneVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        
        res.json(response);
    } catch (err) {
        console.error('Admin requestPhoneVerification error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error requesting phone verification' 
        });
    }
};

export const changeUserCurrency = async (req, res) => {
    try {
        const { currency } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Validate currency against database
        const currencyExists = await Currency.exists({ 
            code: currency, 
            status: 'Enabled' 
        });
        
        if (!currencyExists) {
            const enabledCurrencies = await Currency.find({ status: 'Enabled' }).select('code');
            const validCurrencyCodes = enabledCurrencies.map(c => c.code);
            
            return res.status(400).json({
                success: false,
                message: `Invalid currency. Must be one of: ${validCurrencyCodes.join(', ')}`
            });
        }

        if (user.currency === currency) {
            return res.status(400).json({
                success: false,
                message: 'User already has this currency'
            });
        }
        
        const oldCurrency = user.currency;
        user.currency = currency;
        await user.save();
        
        res.json({
            success: true,
            user: transformUserForFrontend(user),
            message: 'Currency changed successfully'
        });
    } catch (err) {
        console.error('Admin changeUserCurrency error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error changing currency' 
        });
    }
};

export const deleteUserAccount = async (req, res) => {
    try {
        const { confirmation } = req.body;
        
        if (confirmation !== 'DELETE') {
            return res.status(400).json({
                success: false,
                message: 'Confirmation text "DELETE" is required'
            });
        }
        
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            message: 'User account permanently deleted'
        });
    } catch (err) {
        console.error('Admin deleteUserAccount error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error deleting user account'
        });
    }
};

export const assignBotToUser = async (req, res) => {
    try {
        const { botId } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (!botId || !/^[a-f\d]{24}$/i.test(botId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bot ID'
            });
        }
        
        const existingAssignment = await Assignment.findOne({
            userId: user._id,
            itemId: botId,
            type: 'bot_assignment'
        });
        
        if (existingAssignment) {
            return res.status(400).json({
                success: false,
                message: 'This bot is already assigned to the user'
            });
        }
        
        const assignment = new Assignment({
            userId: user._id,
            adminId: req.user.id,
            type: 'bot_assignment',
            itemId: botId,
            status: 'active',
            metadata: {
                assignedAt: new Date(),
                notes: 'Trading bot assigned by admin'
            }
        });
        
        await assignment.save();
        
        res.json({
            success: true,
            user: transformUserForFrontend(user),
            assignment,
            message: 'Bot assigned successfully'
        });
    } catch (err) {
        console.error('Admin assignBotToUser error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error assigning bot' 
        });
    }
};

export const toggleTradeStatus = async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      user.tradingEnabled = !user.tradingEnabled;
      await user.save();
      
      res.json({
        success: true,
        user: transformUserForFrontend(user),
        message: `Trading ${user.tradingEnabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (err) {
      console.error('Admin toggleTradeStatus error:', err);
      res.status(500).json({ 
        success: false,
        message: 'Server error toggling trade status' 
      });
    }
  };

export const updateUserSignal = async (req, res) => {
    try {
        const { signal } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (!signal || !['buy', 'sell', 'hold'].includes(signal)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid signal (must be buy, sell, or hold)'
            });
        }
        
        user.tradingSignal = signal;
        user.tradingSignalUpdatedAt = new Date();
        await user.save();
        
        res.json({
            success: true,
            user: transformUserForFrontend(user),
            message: `Signal updated to ${signal} successfully`
        });
    } catch (err) {
        console.error('Admin updateUserSignal error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating signal' 
        });
    }
};

export const sendMessageToUser = async (req, res) => {
    try {
        const { subject, message } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Subject and message are required'
            });
        }
        
        user.messages = user.messages || [];
        user.messages.push({
            subject,
            message,
            status: 'sent',
            metadata: {
                sentAt: new Date(),
                adminId: req.user.id
            }
        });
        
        await user.save();
        
        res.json({
            success: true,
            message: 'Message sent successfully'
        });
    } catch (err) {
        console.error('Admin sendMessageToUser error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error sending message' 
        });
    }
};