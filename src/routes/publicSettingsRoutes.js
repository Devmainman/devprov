import express from 'express';
import { getPublicSettings } from '../controllers/publicSettingsController.js';

const router = express.Router();

router.get('/', getPublicSettings); // GET /api/public/settings

export default router;
