import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Ticket from '../models/Ticket.js';
import { sendNotification } from '../app.js';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../Uploads'));
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}_${file.originalname}`);
    }
  });
  
  const upload = multer({ 
    storage,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
  });

// Create a new ticket
router.post('/', authenticate, async (req, res) => {
  try {
    const { subject, priority, message } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!subject || !priority || !message) {
      return res.status(400).json({ message: 'Subject, priority, and message are required' });
    }

    // Handle file upload
    let attachment = null;
    if (req.files && req.files.attachment) {
      const file = req.files.attachment;
      if (file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ message: 'File size exceeds 2MB limit' });
      }
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = path.join(__dirname, '../Uploads', fileName);
      await file.mv(filePath);
      attachment = `/Uploads/${fileName}`;
    }

    const ticket = new Ticket({
      userId,
      subject,
      priority,
      status: 'Open',
      customer: {
        name: req.user.name || 'Unknown',
        email: req.user.email || 'unknown@example.com',
        accountType: req.user.accountType || 'Basic',
      },
      messages: [{ sender: 'user', text: message, attachments: attachment ? [attachment] : [] }],
    });

    await ticket.save();

    // Notify admins via WebSocket
    sendNotification('admin', { type: 'new_ticket', ticketId: ticket._id });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all tickets (user-specific or admin)
router.get('/', authenticate, async (req, res) => {
  try {
    const query = req.user.isAdmin ? {} : { userId: req.user.id };
    const tickets = await Ticket.find(query).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ticket by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    if (!req.user.isAdmin && ticket.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message to ticket
router.post('/:id/messages', authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    if (!req.user.isAdmin && ticket.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Handle file upload
    let attachment = null;
    if (req.files && req.files.attachment) {
      const file = req.files.attachment;
      if (file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ message: 'File size exceeds 2MB limit' });
      }
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = path.join(__dirname, '../Uploads', fileName);
      await file.mv(filePath);
      attachment = `/Uploads/${fileName}`;
    }

    const message = {
      sender: req.user.isAdmin ? 'support' : 'user',
      text,
      attachments: attachment ? [attachment] : [],
    };

    ticket.messages.push(message);
    ticket.updatedAt = Date.now();
    await ticket.save();

    // Notify the other party
    const recipient = req.user.isAdmin ? ticket.userId : 'admin';
    sendNotification(recipient, { type: 'new_message', ticketId: ticket._id });

    res.json(ticket);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Close ticket (admin only)
router.put('/:id/close', authenticate, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    ticket.status = 'Closed';
    ticket.updatedAt = Date.now();
    await ticket.save();

    // Notify user
    sendNotification(ticket.userId, { type: 'ticket_closed', ticketId: ticket._id });

    res.json(ticket);
  } catch (error) {
    console.error('Error closing ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;