import Setting from '../models/Setting.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// Configure __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get settings
export const getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    
    // If no settings exist, return default settings
    if (!settings) {
      settings = new Setting({});
      await settings.save();
    }

    res.json({ 
      success: true,
      settings: settings.toObject()
    });
  } catch (err) {
    console.error('Get Settings Error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching settings',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Save settings
export const saveSettings = async (req, res) => {
  try {
    const updates = req.body;
    const files = req.files || {};

    // Handle file uploads (logo and icon)
    const uploadsDir = path.join(__dirname, '../uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    if (files.logo) {
      const logoPath = path.join(uploadsDir, `logo-${Date.now()}.${files.logo.mimetype.split('/')[1]}`);
      await files.logo.mv(logoPath);
      updates.logo = `/uploads/${path.basename(logoPath)}`;
    }

    if (files.icon) {
      const iconPath = path.join(uploadsDir, `icon-${Date.now()}.${files.icon.mimetype.split('/')[1]}`);
      await files.icon.mv(iconPath);
      updates.icon = `/Uploads/${path.basename(iconPath)}`;
    }

    // Update or create settings
    let settings = await Setting.findOne();
    
    if (!settings) {
      settings = new Setting(updates);
    } else {
      // Update fields
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== null) {
          // Handle JSON strings from FormData
          try {
            settings[key] = JSON.parse(value);
          } catch {
            settings[key] = value;
          }
        }
      }
    }

    await settings.save();

    res.json({
      success: true,
      settings: settings.toObject(),
      message: 'Settings saved successfully'
    });
  } catch (err) {
    console.error('Save Settings Error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error saving settings',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};