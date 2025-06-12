const express = require('express');
const { body } = require('express-validator');
const categoryController = require('../controllers/categories');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/featured', categoryController.getFeaturedCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/slug/:slug', categoryController.getCategoryBySlug);

// Admin routes
router.post('/', [auth, admin], [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim(),
  body('parent').optional().isMongoId().withMessage('Invalid parent category ID'),
  body('isActive').optional().isBoolean(),
  body('isFeatured').optional().isBoolean()
], categoryController.createCategory);

router.put('/:id', [auth, admin], [
  body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
  body('description').optional().trim(),
  body('parent').optional().isMongoId().withMessage('Invalid parent category ID'),
  body('isActive').optional().isBoolean(),
  body('isFeatured').optional().isBoolean()
], categoryController.updateCategory);

router.delete('/:id', [auth, admin], categoryController.deleteCategory);
router.patch('/:id/toggle-status', [auth, admin], categoryController.toggleCategoryStatus);
router.put('/reorder', [auth, admin], [
  body('categories').isArray({ min: 1 }).withMessage('Categories array is required')
], categoryController.reorderCategories);

module.exports = router;