const express = require('express');
const { body } = require('express-validator');
const customerStoriesController = require('../controllers/customerStories');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Public routes
router.get('/', customerStoriesController.getAllStories);
router.get('/:slug', customerStoriesController.getStoryBySlug);

// Protected routes
router.post('/submit', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer.email').isEmail().withMessage('Valid email is required'),
  body('story').trim().notEmpty().withMessage('Story content is required'),
  body('occasionType').notEmpty().withMessage('Occasion type is required'),
  body('images').isArray({ min: 1 }).withMessage('At least one image is required')
], customerStoriesController.submitStory);

router.post('/:id/like', auth, customerStoriesController.likeStory);

// Admin routes
router.get('/admin/pending', [auth, admin], customerStoriesController.getPendingStories);
router.put('/admin/:id/approve', [auth, admin], customerStoriesController.approveStory);
router.put('/admin/:id/reject', [auth, admin], customerStoriesController.rejectStory);

module.exports = router;