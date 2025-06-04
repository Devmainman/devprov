// routes/packageRoutes.js
import express from 'express';
import { 
  createPackage, 
  getPackages, 
  updatePackage, 
  deletePackage, 
  togglePackageStatus 
} from '../controllers/packageController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected and require admin access
router.use(authenticate);
router.use(isAdmin);

// Create a new package
router.post('/', createPackage);

// Get all packages
router.get('/', getPackages);

// Update a package
router.put('/:id', updatePackage);

// Delete a package
router.delete('/:id', deletePackage);

// Toggle package status
router.patch('/:id/toggle-status', togglePackageStatus);

export default router;