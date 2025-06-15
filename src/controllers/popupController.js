import mongoose from 'mongoose';
import PopupForm from '../models/PopupForm.js';
import PopupInvoice from '../models/PopupInvoice.js';
import PopupMessage from '../models/PopupMessage.js';
import Assignment from '../models/Assignment.js';

// Get active popup for current user
export const getActivePopup = async (req, res) => {
  try {
    console.log('Fetching active assignments for user:', req.user.id);

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      console.log('Invalid userId format:', req.user.id);
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    console.log('Converted userId to ObjectId:', userId.toString());

    // Query for all active assignments (not completed)
    const assignments = await Assignment.find({
      userId: userId,
      completed: false,
      status: { $in: ['assigned', 'pending_payment'] } // Include relevant statuses
    })
      .populate('popupForm')
      .populate('popupInvoice')
      .populate('popupMessage')
      .sort({ priority: -1, createdAt: -1 }); // Sort by priority and recency

    if (!assignments || assignments.length === 0) {
      console.log('No active assignments found for user:', req.user.id);
      return res.json({ success: false, message: 'No active popups found' });
    }

    // Map assignments to popup data
    const popups = assignments.map(assignment => {
      let popupData;
      let type;

      if (assignment.type === 'popup_form' && assignment.popupForm) {
        type = 'form';
        popupData = {
          _id: assignment._id.toString(),
          itemId: assignment.popupForm._id.toString(),
          type: 'form',
          title: assignment.popupForm.title,
          description: assignment.popupForm.description || '',
          fields: assignment.popupForm.fields || [],
          status: assignment.status,
          blockProgress: assignment.blockProgress
        };
      } else if (assignment.type === 'popup_invoice' && assignment.popupInvoice) {
        type = 'invoice';
        popupData = {
          _id: assignment._id.toString(),
          itemId: assignment.popupInvoice._id.toString(),
          type: 'invoice',
          title: assignment.popupInvoice.title,
          amount: assignment.popupInvoice.amount,
          currency: assignment.popupInvoice.currency,
          description: assignment.popupInvoice.description || '',
          paymentStatus: assignment.popupInvoice.paymentStatus,
          status: assignment.status,
          blockProgress: assignment.blockProgress
        };
      } else if (assignment.type === 'popup_message' && assignment.popupMessage) {
        type = 'message';
        popupData = {
          _id: assignment._id.toString(),
          itemId: assignment.popupMessage._id.toString(),
          type: 'message',
          title: assignment.popupMessage.title,
          description: assignment.popupMessage.description || '',
          filePath: assignment.popupMessage.filePath || '',
          acknowledged: assignment.popupMessage.acknowledged || false,
          status: assignment.status,
          blockProgress: assignment.blockProgress
        };
      } else {
        return null; // Skip invalid assignments
      }

      return popupData;
    }).filter(popup => popup !== null);

    if (popups.length === 0) {
      console.log('No valid popups found after mapping:', req.user.id);
      return res.json({ success: false, message: 'No valid popups found' });
    }

    console.log('Found popups:', popups.map(p => ({
      _id: p._id,
      type: p.type,
      itemId: p.itemId
    })));

    res.json({
      success: true,
      popups // Return all valid popups
    });
  } catch (error) {
    console.error('Error fetching active popups:', {
      message: error.message,
      stack: error.stack,
      userId: req.user.id
    });
    res.status(500).json({ success: false, message: 'Server error fetching popups', error: error.message });
  }
};



// Mark popup as completed
export const completePopup = async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
      },
      { completed: true, status: 'completed' },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Popup assignment not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Popup marked as completed',
    });
  } catch (error) {
    console.error('Error completing popup:', error);
    res.status(500).json({
      success: false,
      message: 'Server error completing popup',
    });
  }
};

export const acknowledgePopupMessage = async (req, res) => {
  try {
    console.log('Acknowledging message for user:', req.user.id, 'assignmentId:', req.params.assignmentId);
    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: req.params.assignmentId,
        userId: req.user.id,
        type: 'popup_message',
      },
      {
        completed: true,
        status: 'acknowledged',
        'metadata.acknowledgedAt': new Date(),
      },
      { new: true }
    );

    if (!assignment) {
      console.log('Assignment not found for ID:', req.params.assignmentId);
      return res.status(404).json({
        success: false,
        message: 'Message assignment not found',
      });
    }

    await PopupMessage.findByIdAndUpdate(assignment.itemId, { acknowledged: true });

    res.status(200).json({
      success: true,
      message: 'Message acknowledged successfully',
    });
  } catch (error) {
    console.error('Error acknowledging message:', error);
    res.status(500).json({
      success: false,
      message: 'Server error acknowledging message',
    });
  }
};

export const getAvailablePopupForms = async (req, res) => {
  try {
    const forms = await PopupForm.find({ status: 'Active' })
      .select('title description fields status icon createdAt');
    res.status(200).json({ success: true, forms });
  } catch (err) {
    console.error('Error fetching forms:', err);
    res.status(500).json({ success: false, message: 'Error fetching forms' });
  }
};

export const getAvailablePopupInvoices = async (req, res) => {
  try {
    const invoices = await PopupInvoice.find({ status: 'Active' })
      .select('title amount currency description assignedTo status createdAt');
    res.status(200).json({ success: true, invoices });
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ success: false, message: 'Error fetching invoices' });
  }
};

export const getAvailablePopupMessages = async (req, res) => {
  try {
    const messages = await PopupMessage.find({ status: 'Active' })
      .select('title description file filePath status createdAt');
    res.status(200).json({ success: true, messages });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, message: 'Error fetching messages' });
  }
};

// Additional exports for getting available popups
