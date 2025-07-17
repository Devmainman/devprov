import mongoose from 'mongoose';

const packageUpgradeInteractionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  pendingPackageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
  startedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['started', 'completed'],
    default: 'started'
  }
}, { timestamps: true });

export default mongoose.model('PackageUpgradeInteraction', packageUpgradeInteractionSchema);
