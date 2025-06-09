import BrowsingHistory from '../models/BrowsingHistory.js';
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

    // Get frontendURL domain
    const settings = await Setting.findOne().select('frontendURL');
    const frontendURL = settings?.frontendURL || 'http://localhost:1200';
    const frontendDomain = url.parse(frontendURL).hostname || getDomain(frontendURL);

    // Build query
    const query = { domain: frontendDomain };
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