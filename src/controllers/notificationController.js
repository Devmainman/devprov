import User from '../models/User.js';
import { sendNotification } from '../app.js';
import { v4 as uuidv4 } from 'uuid';



// Get paginated notifications
export const getNotifications = async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    
    const user = await User.findById(req.user.id)
      .select('notifications unreadCount')
      .slice('notifications', [parseInt(skip), parseInt(limit)]);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      notifications: user.notifications,
      unreadCount: user.unreadCount,
      total: user.notifications.length
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch notifications' 
    });
  }
};

// In notificationController.js
export const createNotification = async (userId, notificationData) => {
  try {
    // Check for duplicate notifications
    const existingNotification = await User.findOne({
      _id: userId,
      'notifications.title': notificationData.title,
      'notifications.content': notificationData.content,
      'notifications.createdAt': { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within 24 hours
    });

    if (existingNotification) {
      return { success: false, message: 'Duplicate notification prevented' };
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $push: { 
          notifications: {
            ...notificationData,
            id: uuidv4(), // Ensure unique ID
            createdAt: new Date()
          } 
        },
        $inc: { unreadCount: 1 }
      },
      { new: true }
    );

    // Send real-time update
    sendNotification(userId, notificationData);

    return { success: true, notification: notificationData };
  } catch (error) {
    console.error('Create notification error:', error);
    return { success: false, message: 'Failed to create notification' };
  }
};

// Get only the unread count
export const getNotificationCount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('unreadCount');
    
    res.json({ 
      success: true,
      unreadCount: user?.unreadCount || 0 
    });
  } catch (error) {
    console.error('Get notification count error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get notification count' 
    });
  }
};

// Mark single notification as read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const user = await User.findOneAndUpdate(
      { 
        _id: req.user.id,
        'notifications.id': notificationId,
        'notifications.isRead': false
      },
      { 
        $set: { 'notifications.$.isRead': true },
        $inc: { unreadCount: -1 }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found or already read' 
      });
    }

    res.json({ 
      success: true,
      unreadCount: user.unreadCount
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark notification as read' 
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const unreadCount = user.notifications.filter(n => !n.isRead).length;

    if (unreadCount === 0) {
      return res.json({ 
        success: true,
        message: 'No unread notifications',
        unreadCount: 0
      });
    }

    await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: { 'notifications.$[].isRead': true },
        $inc: { unreadCount: -unreadCount }
      }
    );

    res.json({ 
      success: true,
      unreadCount: 0
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark all notifications as read' 
    });
  }
};

// Delete a notification
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $pull: { notifications: { id: notificationId } }
      },
      { new: true }
    );

    res.json({ 
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete notification' 
    });
  }
};

// Update notification preferences
export const updateNotificationPreferences = async (req, res) => {
  try {
    const { email, push, inApp } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        'notificationPreferences.email': email,
        'notificationPreferences.push': push,
        'notificationPreferences.inApp': inApp
      },
      { new: true }
    );

    res.json({ 
      success: true,
      preferences: user.notificationPreferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update notification preferences' 
    });
  }
};