const express = require('express');
const { body } = require('express-validator');
const contentController = require('../controllers/content');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Public routes
router.get('/', contentController.getContent);
router.get('/hero', contentController.getHeroContent);
router.get('/announcements', contentController.getAnnouncements);
router.get('/:id', contentController.getContentById);
router.get('/slug/:slug', contentController.getContentBySlug);

// Admin routes
router.get('/admin/all', [auth, admin], contentController.getAllContentAdmin);
router.get('/admin/templates', [auth, admin], contentController.getContentTemplates);
router.get('/admin/type/:type', [auth, admin], contentController.getContentByType);
router.get('/admin/search', [auth, admin], contentController.searchContent);
router.get('/admin/statistics', [auth, admin], contentController.getContentStatistics);
router.get('/admin/export', [auth, admin], contentController.exportContent);
router.get('/admin/:id', [auth, admin], contentController.getContentByIdAdmin);
router.get('/admin/:id/preview', [auth, admin], contentController.previewContent);

router.post('/admin/create', [auth, admin], [
  body('type').isIn(['hero', 'banner', 'menu', 'page', 'block', 'announcement'])
    .withMessage('Invalid content type'),
  body('name').trim().notEmpty().withMessage('Content name is required'),
  body('content').notEmpty().withMessage('Content data is required'),
  body('position').optional().trim(),
  body('displayOrder').optional().isNumeric(),
  body('isActive').optional().isBoolean(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('targetAudience').optional().isIn(['all', 'new_visitors', 'returning_customers', 'vip_customers'])
], contentController.createContent);

router.post('/admin/create-from-template', [auth, admin], [
  body('templateName').trim().notEmpty().withMessage('Template name is required'),
  body('templateType').isIn(['hero', 'banner', 'menu', 'page', 'block', 'announcement'])
    .withMessage('Invalid template type'),
  body('customizations').optional().isObject()
], contentController.createContentFromTemplate);

router.post('/admin/:id/duplicate', [auth, admin], contentController.duplicateContent);
router.post('/admin/validate', [auth, admin], [
  body('type').isIn(['hero', 'banner', 'menu', 'page', 'block', 'announcement'])
    .withMessage('Invalid content type'),
  body('content').notEmpty().withMessage('Content data is required')
], contentController.validateContent);

router.put('/admin/:id', [auth, admin], [
  body('type').optional().isIn(['hero', 'banner', 'menu', 'page', 'block', 'announcement'])
    .withMessage('Invalid content type'),
  body('name').optional().trim().notEmpty().withMessage('Content name cannot be empty'),
  body('content').optional().notEmpty().withMessage('Content data cannot be empty'),
  body('position').optional().trim(),
  body('displayOrder').optional().isNumeric(),
  body('isActive').optional().isBoolean(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('targetAudience').optional().isIn(['all', 'new_visitors', 'returning_customers', 'vip_customers'])
], contentController.updateContent);

router.put('/admin/reorder', [auth, admin], [
  body('content').isArray({ min: 1 }).withMessage('Content array is required')
], contentController.reorderContent);

router.patch('/admin/:id/toggle-status', [auth, admin], contentController.toggleContentStatus);
router.patch('/admin/:id/publish', [auth, admin], contentController.publishContent);
router.patch('/admin/:id/unpublish', [auth, admin], contentController.unpublishContent);
router.patch('/admin/:id/archive', [auth, admin], contentController.archiveContent);
router.patch('/admin/:id/schedule', [auth, admin], [
  body('startDate').notEmpty().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('End date must be valid')
], contentController.scheduleContent);

router.patch('/admin/bulk-update', [auth, admin], [
  body('contentIds').isArray({ min: 1 }).withMessage('Content IDs array is required'),
  body('updates').isObject().withMessage('Updates object is required')
], contentController.bulkUpdateContent);

router.delete('/admin/:id', [auth, admin], contentController.deleteContent);

module.exports = router;