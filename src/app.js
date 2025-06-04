import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fileUpload from 'express-fileupload';
import jwt from 'jsonwebtoken';
import expressWs from 'express-ws';

// Configure __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables first
dotenv.config({ path: path.join(__dirname, '../../config/config.env') });

// Import other dependencies after env is configured
import env from './config/env.js';
import twilio from 'twilio';
import connectDB from './config/db.js';

// Import routes
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import tradingRoutes from './routes/tradingRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminPaymentRoutes from './routes/admin/paymentRoutes.js';
import withdrawalMethodRoutes from './routes/withdrawalMethodRoutes.js';
import depositRoutes from './routes/depositRoutes.js';
import popupFormRoutes from './routes/popupFormRoutes.js';
import popupInvoiceRoutes from './routes/popupInvoiceRoutes.js';
import popupMessageRoutes from './routes/popupMessageRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import packageRoutes from './routes/packageRoutes.js';
import popupFetchRoutes from './routes/popupFetchRoutes.js';
import adminPopupManagementRoutes from './routes/adminPopupManagementRoutes.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import publicWithdrawalRoutes from './routes/publicWithdrawalRoutes.js';
import publicPackageRoutes from './routes/publicPackageRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import verificationRoutes from './routes/verificationRoutes.js';
import adminVerificationRoutes from './routes/adminVerificationRoutes.js';
import massages from './routes/messageRoutes.js';
import adminTradingRoutes from './routes/adminTradingRoutes.js';

// Verify environment loaded
console.log('Environment loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI ? '***masked***' : 'missing',
});

console.log('Twilio Live Check:', {
  sid: env.TWILIO_ACCOUNT_SID?.slice(0, 6) + '...',
  token: env.TWILIO_AUTH_TOKEN?.slice(0, 3) + '...'
});

const app = express();

// Apply express-ws to app
const expressWsInstance = expressWs(app);
app.wsInstance = expressWsInstance;

// Connect to Database
connectDB();

// Initialize Twilio
const twilioClient = env.TWILIO_ACCOUNT_SID 
  ? twilio(
      env.TWILIO_ACCOUNT_SID,
      env.TWILIO_AUTH_TOKEN,
      { region: 'us1' }
    )
  : null;

console.log('Twilio Client Status:', twilioClient ? 'Ready' : 'Disabled');

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  abortOnLimit: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/withdrawals', withdrawalMethodRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/admin/popup-forms', popupFormRoutes);
app.use('/api/admin/popup-invoices', popupInvoiceRoutes);
app.use('/api/admin/popup-messages', popupMessageRoutes);
app.use('/api/admin/assignments', assignmentRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/admin', adminPopupManagementRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api', publicWithdrawalRoutes);
app.use('/api/public/packages', publicPackageRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', popupFetchRoutes);
app.use('/api/admin/verifications', adminVerificationRoutes);
app.use('/api', massages);
app.use('/api/admin/trading', adminTradingRoutes);

// Test routes
app.get('/', (req, res) => {
  res.send('API is running...');
});

app.get('/test-twilio', async (req, res) => {
  if (!twilioClient) return res.status(500).json({ error: 'Twilio not configured' });
  
  try {
    const message = await twilioClient.messages.create({
      body: 'Test from Node',
      from: env.TWILIO_PHONE_NUMBER,
      to: '+2348117927444' // Your number
    });
    res.json({ success: true, sid: message.sid });
  } catch (error) {
    console.error('Twilio Error:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code
    });
  }
});

// Create HTTP server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});


// WebSocket Implementation
const activeConnections = new Map();

expressWsInstance.app.ws('/api/notifications/ws', (ws, req) => {
  // 1. Authenticate using token from query params
  const token = req.query.token;
  
  if (!token) {
    console.log('WebSocket connection rejected: No token provided');
    return ws.close(4001, 'Authentication token required');
  }

  try {
    // 2. Verify JWT without admin check
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.user?.id || decoded.userId;
    
    if (!userId) {
      console.log('WebSocket connection rejected: Invalid token payload');
      return ws.close(4001, 'Invalid user identification');
    }

    // 3. Store connection without admin checks
    ws.userId = userId;
    activeConnections.set(userId, ws);
    console.log(`User ${userId} connected to notifications WebSocket`);

    // 4. Send welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'success',
      timestamp: Date.now()
    }));


    // 5. Heartbeat system
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // 6. Cleanup on close
    ws.on('close', () => {
      activeConnections.delete(userId);
      console.log(`User ${userId} disconnected`);
    });

    // 7. Error handling
    ws.on('error', (error) => {
      console.error(`WS error for user ${userId}:`, error);
      activeConnections.delete(userId);
      ws.terminate();
    });

  } catch (err) {
    console.error('WS auth failed:', err.message);
    ws.close(4001, 'Invalid token');
  }
});

// Heartbeat interval (global)
const heartbeatInterval = setInterval(() => {
  activeConnections.forEach((ws, userId) => {
    if (ws.isAlive === false) {
      console.log(`Terminating dead connection for user ${userId}`);
      activeConnections.delete(userId);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Check every 30 seconds

// Cleanup when server stops
process.on('SIGTERM', () => {
  clearInterval(heartbeatInterval);
  activeConnections.forEach(ws => ws.close(1001, 'Server shutting down'));
});

// Notification sender
export const sendNotification = (userId, data) => {
  const ws = activeConnections.get(userId);
  if (ws && ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: 'notification',
        data: data,
        timestamp: Date.now()
      }));
      return true;
    } catch (err) {
      console.error('WebSocket send error:', err);
      activeConnections.delete(userId);
      return false;
    }
  }
  return false;
};