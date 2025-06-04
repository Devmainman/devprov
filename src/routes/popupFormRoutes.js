// routes/admin/popupFormRoutes.js
import express from 'express';
import {
  getPopupForms,
  createPopupForm,
  updatePopupForm,
  deletePopupForm
} from '../controllers/popupFormController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(authenticate, isAdmin, getPopupForms)
  .post(authenticate, isAdmin, createPopupForm);

router.route('/:id')
  .put(authenticate, isAdmin, updatePopupForm)
  .delete(authenticate, isAdmin, deletePopupForm);

export default router;