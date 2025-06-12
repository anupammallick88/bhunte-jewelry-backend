const express = require('express');
const { body } = require('express-validator');
const blogController = require('../controllers/blog');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Public routes
router.get('/', blogController.getAllBlogPosts);
router.get('/categories', blogController.getBlogCategories);
router.get('/tags', blogController.getPopularTags);
router.get('/:slug', blogController.getBlogPostBySlug);

// Admin routes
router.get('/admin/all', [auth, admin], blogController.getAllBlogPostsAdmin);
router.get('/admin/:id', [auth, admin], blogController.getBlogPostByIdAdmin);

router.post('/admin/create', [auth, admin], [
  body('title').trim().notEmpty().withMessage('Blog post title is required'),
  body('content').trim().notEmpty().withMessage('Blog post content is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('status').optional().isIn(['draft', 'published', 'archived']),
  body('tags').optional().isArray(),
  body('excerpt').optional().trim(),
  body('publishedDate').optional().isISO8601()
], blogController.createBlogPost);

router.put('/admin/:id', [auth, admin], [
  body('title').optional().trim().notEmpty().withMessage('Blog post title cannot be empty'),
  body('content').optional().trim().notEmpty().withMessage('Blog post content cannot be empty'),
  body('category').optional().trim().notEmpty().withMessage('Category cannot be empty'),
  body('status').optional().isIn(['draft', 'published', 'archived']),
  body('tags').optional().isArray(),
  body('excerpt').optional().trim(),
  body('publishedDate').optional().isISO8601()
], blogController.updateBlogPost);

router.delete('/admin/:id', [auth, admin], blogController.deleteBlogPost);

module.exports = router;