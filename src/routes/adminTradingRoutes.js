// routes/adminTradingRoutes.js
import express from 'express';
import { 
  getAllTrades,
  adminUpdateTrade,
  createTradePackage,
  getTradePackages,
  updateTradePackage,
  deleteTradePackage,
  getTradeStatistics
} from '../controllers/adminTradingController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Trade management
router.get('/trades', authenticate, isAdmin, getAllTrades);
router.put('/trades/:id', authenticate, isAdmin, adminUpdateTrade);

// Trade packages
router.post('/trade-packages', authenticate, isAdmin, createTradePackage);
router.get('/trade-packages', authenticate, isAdmin, getTradePackages);
router.put('/trade-packages/:id', authenticate, isAdmin, updateTradePackage);
router.delete('/trade-packages/:id', authenticate, isAdmin, deleteTradePackage);

// Statistics
router.get('/statistics', authenticate, isAdmin, getTradeStatistics);

export default router;