// utils/getUserThreshold.js
import mongoose from 'mongoose';
import Setting from '../models/Setting.js';
import Package from '../models/Package.js';

export const getUserThreshold = async (user) => {
  // ✅ If populated accountType has threshold
  if (user.accountType && typeof user.accountType === 'object' && user.accountType.threshold) {
    return user.accountType.threshold;
  }

  // ✅ If accountType is a valid ObjectId (not populated)
  if (mongoose.Types.ObjectId.isValid(user.accountType)) {
    const pkg = await Package.findById(user.accountType);
    if (pkg && pkg.threshold) return pkg.threshold;
  }

  // ✅ If accountType is object but not populated (missing .threshold)
  if (user.accountType && user.accountType._id && !user.accountType.threshold) {
    const pkg = await Package.findById(user.accountType._id);
    if (pkg && pkg.threshold) return pkg.threshold;
  }

  // ❓ Default fallback
  const settings = await Setting.findOne();
  return settings?.defaultThreshold || 1000;
};
