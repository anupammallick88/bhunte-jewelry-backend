const express = require('express');
const { body } = require('express-validator');
const newsletterController = require('../controllers/newsletter');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Public routes
router.post('/subscribe', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('preferences').optional().isObject(),
  body('source').optional().isIn(['website', 'checkout', 'manual', 'import'])
], newsletterController.subscribe);

router.post('/unsubscribe', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('reason').optional().trim()
], newsletterController.unsubscribe);

router.put('/preferences', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('preferences').isObject().withMessage('Preferences object is required')
], newsletterController.updatePreferences);

// Admin routes
router.get('/admin/subscribers', [auth, admin], newsletterController.getAllSubscribers);
router.get('/admin/export', [auth, admin], newsletterController.exportSubscribers);

router.post('/admin/send-campaign', [auth, admin], [
  body('subject').trim().notEmpty().withMessage('Email subject is required'),
  body('content').trim().notEmpty().withMessage('Email content is required'),
  body('recipientType').optional().isIn(['all', 'tagged']),
  body('tags').optional().isArray()
], newsletterController.sendCampaign);

router.post('/admin/add-tags', [auth, admin], [
  body('emails').isArray({ min: 1 }).withMessage('Emails array is required'),
  body('tags').isArray({ min: 1 }).withMessage('Tags array is required')
], newsletterController.addTagsToSubscribers);

module.exports = router;