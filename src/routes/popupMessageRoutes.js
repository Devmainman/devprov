// routes/admin/popupMessageRoutes.js
import express from 'express';
import {
  getPopupMessages,
  createPopupMessage,
  updatePopupMessage,
  deletePopupMessage
} from '../controllers/popupMessageController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(authenticate, isAdmin, getPopupMessages)
  .post(authenticate, isAdmin, createPopupMessage);

router.route('/:id')
  .put(authenticate, isAdmin, updatePopupMessage)
  .delete(authenticate, isAdmin, deletePopupMessage);

export default router;