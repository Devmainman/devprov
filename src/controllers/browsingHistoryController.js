import BrowsingHistory from '../models/BrowsingHistory.js';
import useragent from 'useragent';
import Setting from '../models/Setting.js';
import pkg from 'tldjs';
const { getDomain } = pkg;
import url from 'url';

export const getBrowsingHistory = async (req, res) => {
  try {
    const {
      search = '',
      role = 'all',
      sortBy = 'date',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    // Get settings for frontend domain
    const settings = await Setting.findOne();
    const frontendURL = settings?.frontendURL || 'http://localhost:1200';
    const frontendDomain = url.parse(frontendURL).hostname || getDomain(frontendURL);

    // TEMP: Remove domain filtering for local testing
    const query = {}; // Allow all domains
    // In production, re-enable domain filtering like:
    // const query = process.env.NODE_ENV === 'development' ? {} : { domain: frontendDomain };

    if (search) {
      query.$or = [
        { ip: { $regex: search, $options: 'i' } },
        { domain: { $regex: search, $options: 'i' } },
        { userRole: { $regex: search, $options: 'i' } }
      ];
    }

    if (role !== 'all') {
      query.userRole = role;
    }

    // Sorting
    const sort = {};
    if (sortBy === 'date') sort.date = sortOrder === 'asc' ? 1 : -1;
    else if (sortBy === 'domain') sort.domain = sortOrder === 'asc' ? 1 : -1;
    else if (sortBy === 'role') sort.userRole = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await BrowsingHistory.countDocuments(query);
    const history = await BrowsingHistory.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: history,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching browsing history:', {
      message: error.message,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: 'Server error fetching browsing history'
    });
  }
};

export const recordVisit = async (req, res) => {
  try {
    const { url, timestamp } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const user = req.user || null;
    const domain = req.hostname;

    const agent = useragent.parse(req.headers['user-agent'] || '');

    const visit = {
      url,
      timestamp: timestamp || new Date(),
    };

    // Try to find an existing history doc
    let history = await BrowsingHistory.findOne({ ip, userId: user?._id || null, domain });

    if (history) {
      // ✅ Update existing history
      history.visitedPages.push(visit);
      history.basicInfo.pagesVisited += 1;
      await history.save();
    } else {
      // ✅ Create new history
      const basicInfo = {
        device: agent.device.toString() || 'Unknown',
        os: agent.os.toString() || 'Unknown',
        browser: agent.toAgent() || 'Unknown',
        resolution: '',
        language: req.headers['accept-language']?.split(',')[0] || 'Unknown',
        referrer: req.headers['referer'] || '',
        pagesVisited: 1,
        sessionDuration: '',
        interactions: 0
      };

      history = await BrowsingHistory.create({
        ip,
        domain,
        userId: user?._id || null,
        userRole: user?.role || 'Guest',
        basicInfo,
        visitedPages: [visit]
      });
    }

    res.status(200).json({ success: true, data: history });

  } catch (err) {
    console.error('❌ Error recording visit:', err);
    res.status(500).json({ success: false, message: 'Failed to record visit' });
  }
};



