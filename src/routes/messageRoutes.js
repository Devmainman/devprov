import express from 'express';
import { authenticate, isAdmin } from '../middleware/auth.js';
import {
  sendMessage,
  getAllMessages,
  getMessageDetails,
  updateMessage,
  deleteMessage,
  resendMessage
} from '../controllers/messageController.js';

const router = express.Router();

// Apply authentication and admin check middleware to all routes
router.use(authenticate, isAdmin);

// Route: POST /messages - Send a new message
router.post('/', sendMessage);

// Route: GET /messages - Get all messages (supports optional filters)
router.get('/:id', getAllMessages);

// Route: GET /messages/:id - Get details of a specific message
router.get('/:id', getMessageDetails);

// Route: PUT /messages/:id - Update a message by ID
router.put('/:id', updateMessage);

// Route: DELETE /messages/:id - Delete a message by ID
router.delete('/:id', deleteMessage);

// Route: POST /messages/:id/resend - Resend a message by ID
router.post('/:id/resend', resendMessage);

export default router;
