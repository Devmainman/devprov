import Assignment from '../models/Assignment.js';
import User from '../models/User.js';
import PopupForm from '../models/PopupForm.js';
import PopupInvoice from '../models/PopupInvoice.js';
import PopupMessage from '../models/PopupMessage.js';

// Assign item to user
export const assignToUser = async (req, res) => {
  try {
    const { userId, type } = req.params;
    const { itemId, notes, dueDate } = req.body;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate item exists based on type
    let item;
    switch (type) {
      case 'form':
        item = await PopupForm.findById(itemId);
        break;
      case 'invoice':
        item = await PopupInvoice.findById(itemId);
        break;
      case 'message':
        item = await PopupMessage.findById(itemId);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid assignment type'
        });
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${type} item not found`
      });
    }

    // Create assignment
    const assignment = new Assignment({
      userId,
      adminId: req.user.id,
      type,
      itemId,
      notes,
      dueDate,
      status: 'pending'
    });

    await assignment.save();

    res.status(201).json({
      success: true,
      assignment
    });
  } catch (err) {
    console.error('Assignment error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error creating assignment'
    });
  }
};

// Get user assignments
export const getUserAssignments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, status } = req.query;

    const query = { userId };
    if (type) query.type = type;
    if (status) query.status = status;

    const assignments = await Assignment.find(query)
      .sort({ createdAt: -1 })
      .populate('itemId', 'title amount description status');

    res.json({
      success: true,
      assignments
    });
  } catch (err) {
    console.error('Get assignments error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching assignments'
    });
  }
};

// Update assignment status
export const updateAssignmentStatus = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { status } = req.body;

    if (!['pending', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const assignment = await Assignment.findByIdAndUpdate(
      assignmentId,
      { status },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    res.json({
      success: true,
      assignment
    });
  } catch (err) {
    console.error('Update assignment error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating assignment'
    });
  }
};