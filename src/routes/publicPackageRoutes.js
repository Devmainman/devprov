// routes/publicPackageRoutes.js
import express from 'express';
import { getPackages } from '../controllers/packageController.js';

const router = express.Router();

// Get all active packages (no auth required)
router.get('/', getPackages);

export default router;