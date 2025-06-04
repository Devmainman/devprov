// notificationRoutes.js
import express from 'express';
import {
  getNotifications,
  getNotificationCount,
  markAsRead,
  markAllAsRead,
  updateNotificationPreferences,
  deleteNotification,
  createNotification
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';


const router = express.Router();

router.post('/welcome', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const hasWelcome = user.notifications.some(n => n.type === 'welcome');
    
    if (!hasWelcome) {
      await createNotification(user._id, {
        type: 'welcome',
        title: 'Welcome to Our App!',
        content: 'Thanks for joining us. Get started by exploring the features!',
        isRead: false
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Welcome notification error:', error); // Log for debugging
    res.status(500).json({ success: false, message: error.message });
  }
});

// Other routes...
router.get('/', authenticate, getNotifications);
router.get('/count', authenticate, getNotificationCount);
router.patch('/:notificationId/read', authenticate, markAsRead);
router.patch('/read-all', authenticate, markAllAsRead);
router.delete('/:notificationId', authenticate, deleteNotification);
router.put('/preferences', authenticate, updateNotificationPreferences);

export default router;