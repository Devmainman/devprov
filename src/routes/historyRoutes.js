// routes/historyRoutes.js
import express from 'express';
import { recordVisit } from '../controllers/browsingHistoryController.js';
import { authenticate } from '../middleware/auth.js';


const router = express.Router();

router.post('/record', authenticate, recordVisit);

export default router;
