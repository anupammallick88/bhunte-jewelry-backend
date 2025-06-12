const express = require('express');
const { body } = require('express-validator');
const settingsController = require('../controllers/settings');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Public route for public settings
router.get('/public', settingsController.getPublicSettings);

// Admin routes
router.get('/admin/all', [auth, admin], settingsController.getAllSettings);
router.get('/admin/category/:category', [auth, admin], settingsController.getSettingsByCategory);

router.post('/admin/create', [auth, admin], [
  body('key').trim().notEmpty().withMessage('Setting key is required'),
  body('value').notEmpty().withMessage('Setting value is required'),
  body('type').isIn(['string', 'number', 'boolean', 'object', 'array']).withMessage('Invalid setting type'),
  body('category').isIn(['general', 'payment', 'shipping', 'email', 'seo', 'social', 'appearance'])
    .withMessage('Invalid setting category'),
  body('description').optional().trim(),
  body('isPublic').optional().isBoolean()
], settingsController.createSetting);

router.put('/admin/:key', [
  body('value').notEmpty().withMessage('Setting value is required'),
  body('description').optional().trim(),
  body('isPublic').optional().isBoolean()
], settingsController.updateSetting);

router.put('/admin/bulk-update', [
  body('settings').isObject().withMessage('Settings object is required')
], settingsController.bulkUpdateSettings);

router.delete('/admin/:key', [auth, admin], settingsController.deleteSetting);
router.post('/admin/initialize', [auth, admin], settingsController.initializeDefaultSettings);

module.exports = router;