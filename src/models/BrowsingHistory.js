import mongoose from 'mongoose';

const browsingHistorySchema = new mongoose.Schema({
  ip: { type: String, required: true },
  domain: { type: String, required: true },
  userRole: { type: String, enum: ['Admin', 'Premium User', 'Guest', 'User'], default: 'Guest' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, default: Date.now },
  basicInfo: {
    device: { type: String, required: true },
    os: { type: String, required: true },
    browser: { type: String, required: true },
    resolution: { type: String },
    language: { type: String },
    referrer: { type: String },
    pagesVisited: { type: Number, default: 0 },
    sessionDuration: { type: String },
    interactions: { type: Number, default: 0 }
  },
  location: {
    country: { type: String },
    city: { type: String },
    region: { type: String },
    postalCode: { type: String },
    timezone: { type: String },
    isp: { type: String }
  },
  cookies: [{
    name: { type: String, required: true },
    purpose: { type: String, required: true }
  }],
  visitedPages: [{
    url: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

browsingHistorySchema.index({ domain: 1, date: -1 });

const BrowsingHistory = mongoose.model('BrowsingHistory', browsingHistorySchema);

export default BrowsingHistory;