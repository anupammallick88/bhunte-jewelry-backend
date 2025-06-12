const express = require('express');
const { body } = require('express-validator');
const collectionController = require('../controllers/collection');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Public routes
router.get('/', collectionController.getAllCollections);
router.get('/featured', collectionController.getFeaturedCollections);
router.get('/search', collectionController.searchCollections);
router.get('/:id', collectionController.getCollectionById);
router.get('/:id/products', collectionController.getCollectionProducts);
router.get('/slug/:slug', collectionController.getCollectionBySlug);

// Admin routes
router.get('/admin/all', [auth, admin], collectionController.getAllCollectionsAdmin);
router.get('/admin/:id', [auth, admin], collectionController.getCollectionByIdAdmin);
router.get('/admin/:id/analytics', [auth, admin], collectionController.getCollectionAnalytics);

router.post('/admin/create', [auth, admin], [
  body('name').trim().notEmpty().withMessage('Collection name is required'),
  body('description').optional().trim(),
  body('slug').optional().trim(),
  body('isFeatured').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
  body('sortOrder').optional().isNumeric(),
  body('settings.showOnHomepage').optional().isBoolean(),
  body('settings.layout').optional().isIn(['grid', 'list', 'masonry'])
], collectionController.createCollection);

router.put('/admin/:id', [auth, admin], [
  body('name').optional().trim().notEmpty().withMessage('Collection name cannot be empty'),
  body('description').optional().trim(),
  body('slug').optional().trim(),
  body('isFeatured').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
  body('sortOrder').optional().isNumeric(),
  body('settings.showOnHomepage').optional().isBoolean(),
  body('settings.layout').optional().isIn(['grid', 'list', 'masonry'])
], collectionController.updateCollection);

router.delete('/admin/:id', [auth, admin], collectionController.deleteCollection);
router.delete('/admin/bulk-delete', [auth, admin], [
  body('collectionIds').isArray({ min: 1 }).withMessage('Collection IDs array is required')
], collectionController.bulkDeleteCollections);

router.patch('/admin/:id/toggle-status', [auth, admin], collectionController.toggleCollectionStatus);
router.post('/admin/:id/clone', [auth, admin], collectionController.cloneCollection);

router.post('/admin/:id/products', [auth, admin], [
  body('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required')
], collectionController.addProductsToCollection);

router.delete('/admin/:id/products', [auth, admin], [
  body('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required')
], collectionController.removeProductsFromCollection);

router.put('/admin/reorder', [auth, admin], [
  body('collections').isArray({ min: 1 }).withMessage('Collections array is required')
], collectionController.reorderCollections);

router.get('/admin/export', [auth, admin], collectionController.exportCollections);

module.exports = router;