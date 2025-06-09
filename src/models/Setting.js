import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
  websiteName: { type: String, default: '' },
  frontendURL: { type: String, default: 'http://localhost:5000/api/admin/login' }, // Renamed from wwwwebsitecom
  websiteUrl: { type: String, default: '' },
  logoutUrl: { type: String, default: '' },
  currencyApiKey: { type: String, default: '' },
  currencyApiUrl: { type: String, default: 'http://api.exchangerate.host/convert' },
  currencyInterval: { type: String, default: 'Every Six Hours' },
  defaultCurrency: { type: String, default: 'Bulgarian Lev (BGN)' },
  adminEmail: { type: String, default: 'nojigpotal@gmail.com' },
  signalStrengthLimit: { type: String, default: '' },
  referralCommission: { type: Number, default: 0 },
  defaultThreshold: { type: Number, default: 0 },
  logo: { type: String, default: '' },
  icon: { type: String, default: '' },
  systemStatus: { type: Boolean, default: false },
  translationStatus: { type: Boolean, default: false },
  withdrawalStatus: { type: Boolean, default: false },
  textedVerificationStatus: { type: Boolean, default: false },
  idVerificationStatus: { type: Boolean, default: false },
  emailVerificationStatus: { type: Boolean, default: false },
  phoneVerificationStatus: { type: Boolean, default: false },
  addressVerificationStatus: { type: Boolean, default: false },
  emailNotificationStatus: { type: Boolean, default: false },
  smsNotificationStatus: { type: Boolean, default: false },
  trackStatus: { type: Boolean, default: false },
  compleStatus: { type: Boolean, default: false },
  referralStatus: { type: Boolean, default: false },
  smtpHost: { type: String, default: 'sandbox.smtp.mbiltrap.io' },
  smtpPort: { type: Number, default: 2525 },
  smtpEncryption: { type: String, default: 'tls' },
  smtpUsername: { type: String, default: '58d43f5520c0e' },
  smtpMailFromName: { type: String, default: 'Net-TradersRx' },
  smtpMailFromAddress: { type: String, default: 'support@net-tradersfx.org' },
  smtpPassword: { type: String, default: '' }
}, { timestamps: true });

const Setting = mongoose.model('Setting', settingSchema);

export default Setting;