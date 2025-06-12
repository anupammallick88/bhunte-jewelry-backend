const Setting = require('../models/Setting');
const { validationResult } = require('express-validator');

// @desc    Get public settings
// @route   GET /api/settings/public
// @access  Public
exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await Setting.find({ isPublic: true }).lean();
    
    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.key] = setting.value;
    });

    res.json({
      success: true,
      settings: settingsObject
    });
  } catch (error) {
    console.error('Error in getPublicSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all settings (Admin)
// @route   GET /api/settings/admin/all
// @access  Private/Admin
exports.getAllSettings = async (req, res) => {
  try {
    const { category } = req.query;
    
    const query = {};
    if (category) {
      query.category = category;
    }

    const settings = await Setting.find(query)
      .sort({ category: 1, key: 1 })
      .lean();

    // Group settings by category
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    res.json({
      success: true,
      settings: groupedSettings
    });
  } catch (error) {
    console.error('Error in getAllSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get settings by category (Admin)
// @route   GET /api/settings/admin/category/:category
// @access  Private/Admin
exports.getSettingsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    const settings = await Setting.find({ category })
      .sort({ key: 1 })
      .lean();

    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.key] = {
        value: setting.value,
        type: setting.type,
        description: setting.description,
        isPublic: setting.isPublic
      };
    });

    res.json({
      success: true,
      category,
      settings: settingsObject
    });
  } catch (error) {
    console.error('Error in getSettingsByCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update setting (Admin)
// @route   PUT /api/settings/admin/:key
// @access  Private/Admin
exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description, isPublic } = req.body;

    let setting = await Setting.findOne({ key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    // Validate value based on type
    if (setting.type === 'boolean') {
      if (typeof value !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Value must be a boolean'
        });
      }
    } else if (setting.type === 'number') {
      if (typeof value !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Value must be a number'
        });
      }
    }

    setting.value = value;
    if (description !== undefined) setting.description = description;
    if (isPublic !== undefined) setting.isPublic = isPublic;

    await setting.save();

    res.json({
      success: true,
      message: 'Setting updated successfully',
      setting
    });
  } catch (error) {
    console.error('Error in updateSetting:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update multiple settings (Admin)
// @route   PUT /api/settings/admin/bulk-update
// @access  Private/Admin
exports.bulkUpdateSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object is required'
      });
    }

    const updatePromises = Object.entries(settings).map(async ([key, value]) => {
      return Setting.findOneAndUpdate(
        { key },
        { value },
        { new: true, upsert: false }
      );
    });

    const results = await Promise.allSettled(updatePromises);
    
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;

    res.json({
      success: true,
      message: `Updated ${successful} settings successfully`,
      statistics: {
        successful,
        failed,
        total: results.length
      }
    });
  } catch (error) {
    console.error('Error in bulkUpdateSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create setting (Admin)
// @route   POST /api/settings/admin/create
// @access  Private/Admin
exports.createSetting = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { key, value, type, category, description, isPublic } = req.body;

    // Check if setting already exists
    const existingSetting = await Setting.findOne({ key });
    if (existingSetting) {
      return res.status(400).json({
        success: false,
        message: 'Setting with this key already exists'
      });
    }

    const setting = new Setting({
      key,
      value,
      type,
      category,
      description,
      isPublic: isPublic || false
    });

    await setting.save();

    res.status(201).json({
      success: true,
      message: 'Setting created successfully',
      setting
    });
  } catch (error) {
    console.error('Error in createSetting:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete setting (Admin)
// @route   DELETE /api/settings/admin/:key
// @access  Private/Admin
exports.deleteSetting = async (req, res) => {
  try {
    const { key } = req.params;

    const setting = await Setting.findOneAndDelete({ key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    res.json({
      success: true,
      message: 'Setting deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteSetting:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Initialize default settings
// @route   POST /api/settings/admin/initialize
// @access  Private/Admin
exports.initializeDefaultSettings = async (req, res) => {
  try {
    const defaultSettings = [
      // General Settings
      { key: 'site_name', value: 'Angara Jewelry', type: 'string', category: 'general', description: 'Website name', isPublic: true },
      { key: 'site_description', value: 'Exquisite handcrafted jewelry', type: 'string', category: 'general', description: 'Site description for SEO', isPublic: true },
      { key: 'contact_email', value: 'contact@angara.com', type: 'string', category: 'general', description: 'Main contact email', isPublic: true },
      { key: 'contact_phone', value: '+1-844-527-4367', type: 'string', category: 'general', description: 'Contact phone number', isPublic: true },
      { key: 'business_address', value: '550 South Hill St, Suite 1600, Los Angeles, CA 90013', type: 'string', category: 'general', description: 'Business address', isPublic: true },
      
      // Payment Settings
      { key: 'paypal_mode', value: 'sandbox', type: 'string', category: 'payment', description: 'PayPal mode (sandbox/live)', isPublic: false },
      { key: 'stripe_mode', value: 'test', type: 'string', category: 'payment', description: 'Stripe mode (test/live)', isPublic: false },
      { key: 'payment_methods', value: ['paypal', 'stripe'], type: 'array', category: 'payment', description: 'Enabled payment methods', isPublic: true },
      
      // Shipping Settings
      { key: 'free_shipping_threshold', value: 100, type: 'number', category: 'shipping', description: 'Free shipping minimum amount', isPublic: true },
      { key: 'default_shipping_cost', value: 10, type: 'number', category: 'shipping', description: 'Default shipping cost', isPublic: true },
      { key: 'shipping_regions', value: ['US', 'CA', 'EU'], type: 'array', category: 'shipping', description: 'Supported shipping regions', isPublic: true },
      
      // Email Settings
      { key: 'email_from_name', value: 'Angara Jewelry', type: 'string', category: 'email', description: 'Email sender name', isPublic: false },
      { key: 'email_from_address', value: 'noreply@angara.com', type: 'string', category: 'email', description: 'Email sender address', isPublic: false },
      { key: 'email_notifications', value: true, type: 'boolean', category: 'email', description: 'Enable email notifications', isPublic: false },
      
      // SEO Settings
      { key: 'meta_title', value: 'Angara - Fine Jewelry Store', type: 'string', category: 'seo', description: 'Default meta title', isPublic: true },
      { key: 'meta_description', value: 'Discover exquisite handcrafted jewelry at Angara', type: 'string', category: 'seo', description: 'Default meta description', isPublic: true },
      { key: 'meta_keywords', value: ['jewelry', 'diamonds', 'rings', 'necklaces', 'earrings'], type: 'array', category: 'seo', description: 'Default meta keywords', isPublic: true },
      
      // Social Media Settings
      { key: 'facebook_url', value: '', type: 'string', category: 'social', description: 'Facebook page URL', isPublic: true },
      { key: 'instagram_url', value: '', type: 'string', category: 'social', description: 'Instagram profile URL', isPublic: true },
      { key: 'twitter_url', value: '', type: 'string', category: 'social', description: 'Twitter profile URL', isPublic: true },
      { key: 'pinterest_url', value: '', type: 'string', category: 'social', description: 'Pinterest profile URL', isPublic: true },
      
      // Appearance Settings
      { key: 'primary_color', value: '#185181', type: 'string', category: 'appearance', description: 'Primary brand color', isPublic: true },
      { key: 'secondary_color', value: '#498c9c', type: 'string', category: 'appearance', description: 'Secondary brand color', isPublic: true },
      { key: 'accent_color', value: '#91cabf', type: 'string', category: 'appearance', description: 'Accent color', isPublic: true },
      { key: 'logo_url', value: '', type: 'string', category: 'appearance', description: 'Logo image URL', isPublic: true },
      { key: 'favicon_url', value: '', type: 'string', category: 'appearance', description: 'Favicon URL', isPublic: true }
    ];

    const existingSettings = await Setting.find().lean();
    const existingKeys = existingSettings.map(setting => setting.key);

    const newSettings = defaultSettings.filter(setting => 
      !existingKeys.includes(setting.key)
    );

    if (newSettings.length === 0) {
      return res.json({
        success: true,
        message: 'All default settings already exist',
        created: 0
      });
    }

    await Setting.insertMany(newSettings);

    res.json({
      success: true,
      message: `Initialized ${newSettings.length} default settings`,
      created: newSettings.length
    });
  } catch (error) {
    console.error('Error in initializeDefaultSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};