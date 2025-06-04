// routes/adminPopupManagementRoutes.js
import express from 'express';
import {
  getPopupAssignments,
  toggleAssignmentStatus,
  deleteAssignment,
  getUserPopupAssignments
} from '../controllers/adminPopupManagementController.js';

const router = express.Router();

// Popup assignments management
router.get('/popup-assignments', getPopupAssignments);
router.patch('/popup-assignments/:id/toggle-status', toggleAssignmentStatus);
router.delete('/popup-assignments/:id', deleteAssignment);
router.get('/users/:userId/popup-assignments', getUserPopupAssignments);

export default router;