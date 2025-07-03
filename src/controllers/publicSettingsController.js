import Setting from '../models/Setting.js';

export const getPublicSettings = async (req, res) => {
  try {
    const settings = await Setting.findOne().lean();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found',
      });
    }

    res.json({
      success: true,
      settings: {
        logoutUrl: settings.logoutUrl || '/auth', // Default fallback
        websiteName: settings.websiteName || '',
        frontendURL: settings.frontendURL || '',
        logo: settings.logo || '',
        icon: settings.icon || '',
      },
    });
  } catch (error) {
    console.error('Public settings fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching public settings',
    });
  }
};
