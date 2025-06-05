import express from 'express';
import { verifyAdminAccess } from '../controllers/authController.js';

const router = express.Router();

router.post('/auth/admin-access', verifyAdminAccess);

export default router;