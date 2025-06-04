import PopupForm from '../models/PopupForm.js';
import PopupInvoice from '../models/PopupInvoice.js';
import PopupMessage from '../models/PopupMessage.js';
import FormSubmission from '../models/FormSubmission.js';
import PaymentMethod from '../models/PaymentMethod.js';
import User from '../models/User.js';
import Assignment from '../models/Assignment.js';

// Get active popup for current user
export const getActivePopup = async (req, res) => {
  try {
    console.log('Fetching popups for user:', req.user.id);
    const assignment = await Assignment.findOne({
      userId: req.user.id,
      status: 'assigned',
      completed: { $ne: true }
    }).sort({ createdAt: 1 });
    
    console.log('Found assignment:', assignment);
    
    if (!assignment) {
      console.log('No active popups found');
      return res.status(404).json({ 
        success: false,
        message: 'No active popups found' 
      });
    }

    let popupData;
    switch (assignment.type) {
      case 'popup_form':
        popupData = await PopupForm.findById(assignment.itemId);
        break;
      case 'popup_invoice':
        popupData = await PopupInvoice.findById(assignment.itemId);
        break;
      case 'popup_message':
        popupData = await PopupMessage.findById(assignment.itemId);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Unknown popup type'
        });
    }

    res.json({
      success: true,
      popup: {
        _id: assignment._id,
        type: assignment.type.replace('popup_', ''),
        title: popupData.title,
        description: popupData.description,
        ...(assignment.metadata || {}),
        ...(assignment.type === 'popup_invoice' && { 
          amount: popupData.amount,
          currency: popupData.currency 
        }),
        ...(assignment.type === 'popup_form' && {
          fields: popupData.fields
        })
      }
    });
  } catch (error) {
    console.error('Error getting active popup:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching popup'
    });
  }
};

// Mark popup as completed
export const completePopup = async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id
      },
      { completed: true },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Popup assignment not found'
      });
    }

    res.json({
      success: true,
      message: 'Popup marked as completed'
    });
  } catch (error) {
    console.error('Error completing popup:', error);
    res.status(500).json({
      success: false,
      message: 'Server error completing popup'
    });
  }
};

// Handle form submission
export const submitPopupForm = async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
        type: 'popup_form'
      },
      { 
        completed: true,
        'metadata.formData': req.body 
      },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Form assignment not found'
      });
    }

    res.json({
      success: true,
      message: 'Form submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({
      success: false,
      message: 'Server error submitting form'
    });
  }
};

// Handle invoice payment
export const payPopupInvoice = async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
        type: 'popup_invoice'
      },
      { 
        completed: true,
        'metadata.paymentStatus': 'paid',
        'metadata.paymentDate': new Date()
      },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Invoice assignment not found'
      });
    }

    res.json({
      success: true,
      message: 'Invoice paid successfully'
    });
  } catch (error) {
    console.error('Error paying invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing payment'
    });
  }
};

// Handle message acknowledgement
export const acknowledgePopupMessage = async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
        type: 'popup_message'
      },
      { 
        completed: true,
        'metadata.acknowledgedAt': new Date()
      },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Message assignment not found'
      });
    }

    res.json({
      success: true,
      message: 'Message acknowledged successfully'
    });
  } catch (error) {
    console.error('Error acknowledging message:', error);
    res.status(500).json({
      success: false,
      message: 'Server error acknowledging message'
    });
  }
};

// Additional exports for getting available popups
export const getAvailablePopupForms = async (req, res) => {
  try {
    const forms = await PopupForm.find({ status: 'Active' })
      .select('title description fields status icon createdAt');
    res.json(forms);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching forms' });
  }
};

export const getAvailablePopupInvoices = async (req, res) => {
  try {
    const invoices = await PopupInvoice.find({ status: 'Active' })
      .select('title amount currency description assignedTo status createdAt');
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching invoices' });
  }
};

export const getAvailablePopupMessages = async (req, res) => {
  try {
    const messages = await PopupMessage.find({ status: 'Active' })
      .select('title description file filePath status createdAt');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
};