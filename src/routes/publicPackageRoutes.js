import express from 'express';
import { getPackages, getUserPackages } from '../controllers/packageController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Public route — no authentication needed
router.get('/user-packages', getUserPackages);
router.get('/', getPackages);

export default router;
