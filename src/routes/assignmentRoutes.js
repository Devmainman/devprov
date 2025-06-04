import express from 'express';
import {
 
 
  updateAssignmentStatus,
  getUserAssignments,
 
  
} from '../controllers/assignmentController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(authenticate, isAdmin, getUserAssignments)
 

router.route('/:id')
  .put(authenticate, isAdmin, updateAssignmentStatus)
  



export default router;