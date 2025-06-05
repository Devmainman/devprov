import User from '../models/User.js';
import Assignment from '../models/Assignment.js';
import Package from '../models/Package.js';
import PopupForm from '../models/PopupForm.js';
import PopupInvoice from '../models/PopupInvoice.js';
import PopupMessage from '../models/PopupMessage.js';
import jwt from 'jsonwebtoken';

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
        mobile: formatPhone(user.mobile || user.phoneNumber || ''),
        phoneNumber: formatPhone(user.phoneNumber || user.mobile || ''),
        country: user.country || user.address?.country || 'Not set',
        currency: user.currency || 'USD',
        accountType: user.accountType || 'Basic',
        walletBalance: typeof user.walletBalance === 'number' ? user.walletBalance : 0,
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
        transformed.mobile = phoneValue === 'Not set' || phoneValue.trim() === '' 
            ? '' 
            : phoneValue.replace(/\D/g, '');
        
        if (transformed.mobile.startsWith('0')) {
            transformed.mobile = '234' + transformed.mobile.substring(1);
        } else if (!transformed.mobile.startsWith('234') && transformed.mobile.length > 0) {
            transformed.mobile = '234' + transformed.mobile;
        }
    }
    
    delete transformed.phoneNumber;
    delete transformed._rawMobile;
    
    return transformed;
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
            .select('firstName lastName email mobile country currency accountId accountType walletBalance status joinedDate address verification tradingEnabled tradingSignal tradingSignalUpdatedAt withdrawalLocked messages')
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
            .select('firstName lastName email mobile country currency accountId accountType walletBalance status joinedDate address verification tradingEnabled tradingSignal tradingSignalUpdatedAt withdrawalLocked messages');
        
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
        
        if (!amount || isNaN(amount)) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }
        
        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (type === 'credit') {
            user.walletBalance += parseFloat(amount);
        } else {
            if (user.walletBalance < amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient funds'
                });
            }
            user.walletBalance -= parseFloat(amount);
        }
        
        user.transactions = user.transactions || [];
        user.transactions.push({
            amount: Math.abs(amount),
            currency: user.currency,
            type: type === 'credit' ? 'deposit' : 'withdrawal',
            status: 'completed',
            reference: `ADJ-${Date.now()}`,
            metadata: {
                adminAction: true,
                notes
            }
        });
        
        await user.save();
        
        res.json({
            success: true,
            user: transformUserForFrontend(user)
        });
    } catch (err) {
        console.error('Admin updateWalletBalance error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating wallet balance' 
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

export const assignPopupForm = async (req, res) => {
    try {
        const { userId, popupFormId } = req.params;
        
        const user = await User.findById(userId);
        const popupForm = await PopupForm.findById(popupFormId);
        
        if (!user || !popupForm) {
            return res.status(404).json({
                success: false,
                message: 'User or popup form not found'
            });
        }
        
        const assignment = new Assignment({
            userId: user._id,
            adminId: req.user.id,
            type: 'popup_form',
            itemId: popupForm._id,
            title: popupForm.title,
            status: 'assigned',
            metadata: {
                title: popupForm.title,
                description: popupForm.description,
                fieldsCount: popupForm.fields.length
            }
        });
        
        await assignment.save();
        
        res.json({
            success: true,
            user: transformUserForFrontend(user),
            assignment
        });
    } catch (err) {
        console.error('Admin assignPopupForm error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error assigning popup form' 
        });
    }
};

export const assignPopupInvoice = async (req, res) => {
    try {
        const { userId, popupInvoiceId } = req.params;
        
        const user = await User.findById(userId);
        const popupInvoice = await PopupInvoice.findById(popupInvoiceId);
        
        if (!user || !popupInvoice) {
            return res.status(404).json({
                success: false,
                message: 'User or popup invoice not found'
            });
        }
        
        const assignment = new Assignment({
            userId: user._id,
            adminId: req.user.id,
            type: 'popup_invoice',
            itemId: popupInvoice._id,
            status: 'pending_payment',
            title: popupInvoice.title,
            metadata: {
                title: popupInvoice.title,
                amount: popupInvoice.amount,
                currency: popupInvoice.currency,
                description: popupInvoice.description,
                assignedTo: popupInvoice.assignedTo,
                paymentstatus: 'Unpaid'
            }
        });
        
        await assignment.save();
        
        res.json({
            success: true,
            user: transformUserForFrontend(user),
            assignment
        });
    } catch (err) {
        console.error('Admin assignPopupInvoice error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error assigning popup invoice' 
        });
    }
};

export const assignPopupMessage = async (req, res) => {
    try {
        const { userId, popupMessageId } = req.params;
        
        const user = await User.findById(userId);
        const popupMessage = await PopupMessage.findById(popupMessageId);
        
        if (!user || !popupMessage) {
            return res.status(404).json({
                success: false,
                message: 'User or popup message not found'
            });
        }
        
        const existingAssignment = await Assignment.findOne({
            userId: user._id,
            itemId: popupMessage._id,
            type: 'popup_message'
        });
        
        if (existingAssignment) {
            return res.status(400).json({
                success: false,
                message: 'This popup message is already assigned to the user'
            });
        }
        
        const assignment = new Assignment({
            userId: user._id,
            adminId: req.user.id,
            type: 'popup_message',
            itemId: popupMessage._id,
            title: popupMessage.title,
            status: 'assigned',
            metadata: {
                title: popupMessage.title,
                description: popupMessage.description,
                hasAttachment: !!popupMessage.filePath,
                filePath: popupMessage.filePath
            }
        });
        
        await assignment.save();
        
        res.json({
            success: true,
            user: transformUserForFrontend(user),
            assignment
        });
    } catch (err) {
        console.error('Admin assignPopupMessage error:', err);
        
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
        
        res.status(500).json({ 
            success: false,
            message: 'Server error assigning popup message',
            error: err.message
        });
    }
};

export const resetUserPassword = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const tempPassword = Math.random().toString(36).slice(-8);
        user.password = tempPassword;
        await user.save();
        
        const response = {
            success: true,
            message: 'Password reset successful'
        };
        
        if (process.env.NODE_ENV === 'development') {
            response.tempPassword = tempPassword;
        }
        
        res.json(response);
    } catch (err) {
        console.error('Admin resetUserPassword error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error resetting password' 
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
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const tempToken = jwt.sign(
            { userId: user._id, isAdminAccess: true },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        // Construct the frontend dashboard URL with the token
        const dashboardUrl = `http://localhost:1200/?adminAccessToken=${tempToken}`;
        
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
        
        if (!currency || !['USD', 'EUR', 'GBP', 'NGN'].includes(currency)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid currency'
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