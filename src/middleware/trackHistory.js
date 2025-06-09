import BrowsingHistory from '../models/BrowsingHistory.js';
import Setting from '../models/Setting.js';
import { UAParser } from 'ua-parser-js'; // Use named import
import geoip from 'geoip-lite';
import pkg from 'tldjs';
const { getDomain } = pkg;
import url from 'url';

export const trackHistory = async (req, res, next) => {
  try {
    // Skip admin routes
    if (req.path.includes('/api/admin') || req.path.includes('/api/secret-admin')) {
      return next();
    }

    // Get frontendURL from settings
    const settings = await Setting.findOne().select('frontendURL');
    const frontendURL = settings?.frontendURL || 'http://localhost:1200';
    const frontendDomain = url.parse(frontendURL).hostname || getDomain(frontendURL);

    // Compare request domain
    const requestDomain = getDomain(req.headers['host']);
    if (!frontendDomain || requestDomain !== frontendDomain) {
      return next();
    }

    const ip = req.ip || req.connection.remoteAddress;
    const parser = new UAParser(req.headers['user-agent']); // Instantiate UAParser
    const ua = parser.getResult();
    const geo = geoip.lookup(ip);

    const historyEntry = {
      ip,
      domain: frontendDomain,
      userRole: req.user ? req.user.role : 'Guest',
      userId: req.user ? req.user._id : null,
      date: new Date(),
      basicInfo: {
        device: ua.device.type || 'Desktop',
        os: `${ua.os.name || 'Unknown'} ${ua.os.version || ''}`,
        browser: `${ua.browser.name || 'Unknown'} ${ua.browser.version || ''}`,
        resolution: '', // Requires client-side data
        language: req.headers['accept-language']?.split(',')[0] || 'en-US',
        referrer: req.get('referer') || 'Direct',
        pagesVisited: 1,
        sessionDuration: '0s', // Update via session end
        interactions: 0 // Increment via frontend events
      },
      location: {
        country: geo?.country || '',
        city: geo?.city || '',
        region: geo?.region || '',
        postalCode: geo?.zip || '',
        timezone: geo?.timezone || '',
        isp: geo?.org || ''
      },
      cookies: Object.entries(req.cookies || {}).map(([name]) => ({
        name,
        purpose: name.includes('session') ? 'Authentication' : 'Tracking'
      })),
      visitedPages: [
        { url: req.originalUrl, timestamp: new Date() }
      ]
    };

    await BrowsingHistory.create(historyEntry);
    console.log(`Tracked visit to ${frontendDomain} from IP ${ip}`);
    next();
  } catch (error) {
    console.error('Tracking history error:', error.message);
    next();
  }
};