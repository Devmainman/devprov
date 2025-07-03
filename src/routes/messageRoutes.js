import express from 'express';
import { authenticate, isAdmin } from '../middleware/auth.js';
import {
  sendMessage,
  getAllMessages,
  getMessageDetails,
  updateMessage,
  deleteMessage,
  resendMessage,
  getUserAllMessages,
  getSentMessages
} from '../controllers/messageController.js';

const router = express.Router();

// Apply auth and admin checks globally
router.use(authenticate, isAdmin);

// ✅ This must come first — before dynamic `/:id` routes
router.get('/sent', getSentMessages);

// For viewing all messages sent to a user (admin viewing specific user inbox)
router.get('/user/:id/all-messages', getUserAllMessages);

// Send new message
router.post('/', sendMessage);

// Update a message
router.put('/:id', updateMessage);

// Delete a message
router.delete('/:id', deleteMessage);

// Resend a message
router.post('/:id/resend', resendMessage);

// Get details of a message
router.get('/details/:id', getMessageDetails);

// (Optional legacy) Get all messages using id — if this exists, ensure it doesn’t conflict
// router.get('/:id', getAllMessages);

export default router;
