// controllers/adminPopupManagementController.js
import Assignment from '../models/Assignment.js';
import User from '../models/User.js';
import PopupForm from '../models/PopupForm.js';
import PopupInvoice from '../models/PopupInvoice.js';
import PopupMessage from '../models/PopupMessage.js';

// Helper function to transform assignment for frontend
const transformAssignmentForFrontend = (assignment) => {
  if (!assignment) return null;

  const title = assignment.title || 
                assignment.metadata?.title || 
                (assignment.type === 'popup_invoice' ? 'Invoice' : 
                assignment.type === 'popup_form' ? 'Form' : 'Message');

    const paymentstatus = assignment.type === 'popup_invoice' 
    ? (assignment.metadata?.paymentstatus || 
        (assignment.status === 'completed' ? 'Paid' : 'Unpaid'))
    : undefined;
                
  return {
    _id: assignment._id,
    date: assignment.createdAt,
    accountId: assignment.user?.accountId || 'N/A',
    fullName: assignment.user ? `${assignment.user.firstName} ${assignment.user.lastName}` : 'N/A',
    title: title,
    type: assignment.type,
    status: assignment.status,
    paymentstatus,
    description: assignment.description,
    userId: assignment.userId,
    itemId: assignment.itemId,
    metadata: assignment.metadata
  };
};

// Get all popup assignments with filtering
export const getPopupAssignments = async (req, res) => {
  try {
    const { 
      search = '', 
      type, 
      status, 
      page = 1, 
      limit = 10 
    } = req.query;
    
    const query = {
      type: { $in: ['popup_message', 'popup_form', 'popup_invoice'] }
    };
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'user.accountId': { $regex: search, $options: 'i' } },
        { 'user.firstName': { $regex: search, $options: 'i' } },
        { 'user.lastName': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }
    
    const assignments = await Assignment.find(query)
      .populate('user', 'accountId firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await Assignment.countDocuments(query);
    
    res.json({
      success: true,
      assignments: assignments.map(transformAssignmentForFrontend),
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Admin getPopupAssignments error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching popup assignments' 
    });
  }
};

// Toggle assignment status (enable/disable)
export const toggleAssignmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const assignment = await Assignment.findById(id);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }
    
    // Toggle between assigned and disabled
    if (assignment.status === 'disabled') {
      assignment.status = 'assigned';
    } else {
      assignment.status = 'disabled';
    }
    
    await assignment.save();
    
    res.json({
      success: true,
      assignment: transformAssignmentForFrontend(assignment)
    });
  } catch (err) {
    console.error('Admin toggleAssignmentStatus error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error toggling assignment status' 
    });
  }
};

// Delete an assignment
export const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (err) {
    console.error('Admin deleteAssignment error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error deleting assignment' 
    });
  }
};

// Get assignments for a specific user
export const getUserPopupAssignments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, status } = req.query;
    
    const query = { 
      userId,
      type: { $in: ['popup_message', 'popup_form', 'popup_invoice'] }
    };
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }
    
    const assignments = await Assignment.find(query)
      .populate('user', 'accountId firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      assignments: assignments.map(transformAssignmentForFrontend)
    });
  } catch (err) {
    console.error('Admin getUserPopupAssignments error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching user popup assignments' 
    });
  }
};