import Message from '../models/Message.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

// Send a new message
export const sendMessage = async (req, res) => {
  try {
    const { recipientId, subject, content, isSystemMessage = false } = req.body;

    // Validate recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    const message = new Message({
      sender: req.user.id,
      recipient: recipientId,
      subject,
      content,
      isSystemMessage
    });

    await message.save();

    // Add notification to user
    await User.findByIdAndUpdate(recipientId, {
      $push: {
        notifications: {
          type: 'system',
          title: 'New Message',
          content: `You have a new message: ${subject}`,
          metadata: { messageId: message._id }
        }
      },
      $inc: { unreadCount: 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all messages sent by the currently logged-in admin
export const getSentMessages = async (req, res) => {
  console.log('REQ.USER:', req.user);

  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    let query = { sender: req.user.id };

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    const messages = await Message.find(query)
      .populate('recipientDetails')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments(query);

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('getSentMessages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sent messages'
    });
  }
};



// GET /admin/users/:id/all-messages
export const getUserAllMessages = async (req, res) => {
  try {
    const userId = req.params.id;

    const [user, messages] = await Promise.all([
      User.findById(userId).select('notifications fullName email').lean(),
      Message.find({ recipient: userId })
        .populate('senderDetails')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Combine all into a unified format (optional)
    const notifications = user.notifications.map(n => ({
      _type: 'notification',
      title: n.title,
      content: n.content,
      isRead: n.isRead,
      createdAt: n.createdAt,
      metadata: n.metadata
    }));

    const emails = messages.map(m => ({
      _type: 'email',
      subject: m.subject,
      content: m.content,
      status: m.status,
      createdAt: m.createdAt,
      senderEmail: m.senderDetails?.email || 'Admin'
    }));

    res.json({
      success: true,
      data: [...emails, ...notifications].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )
    });
  } catch (error) {
    console.error('Error fetching all user messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user messages'
    });
  }
};


// Get all messages (admin view)
export const getAllMessages = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    const messages = await Message.find(query)
  .populate({ path: 'recipientDetails' })
  .populate({ path: 'senderDetails' })
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit)
  .exec(); // 🔥 Important to enable virtuals


    const total = await Message.countDocuments(query);

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

// Get message details
export const getMessageDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findById(id)
  .populate({ path: 'recipientDetails' })
  .populate({ path: 'senderDetails' })
  .exec(); // 🔥 Needed for virtuals


    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Get message details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch message details'
    });
  }
};

// Update a message
export const updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, content } = req.body;

    const message = await Message.findByIdAndUpdate(
      id,
      { subject, content },
      { new: true, runValidators: true }
    )
    .populate({ path: 'recipientDetails' })
    .exec();
    

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    res.json({
      success: true,
      message: 'Message updated successfully',
      data: message
    });
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update message'
    });
  }
};

// Delete a message
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findByIdAndDelete(id);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
};

// Resend a message
export const resendMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const originalMessage = await Message.findById(id);
    if (!originalMessage) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Create a new message with the same content
    const newMessage = new Message({
      sender: req.user.id,
      recipient: originalMessage.recipient,
      subject: originalMessage.subject,
      content: originalMessage.content,
      isSystemMessage: originalMessage.isSystemMessage
    });

    await newMessage.save();

    // Add notification to user
    await User.findByIdAndUpdate(originalMessage.recipient, {
      $push: {
        notifications: {
          type: 'system',
          title: 'New Message',
          content: `You have a new message: ${originalMessage.subject}`,
          metadata: { messageId: newMessage._id }
        }
      },
      $inc: { unreadCount: 1 }
    });

    res.json({
      success: true,
      message: 'Message resent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Resend message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend message'
    });
  }
};