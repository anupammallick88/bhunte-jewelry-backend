const express = require('express');
const { body } = require('express-validator');
const reviewController = require('../controllers/reviews');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Public routes
router.get('/product/:productId', reviewController.getProductReviews);

// Protected routes
router.post('/', auth, [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('title').trim().notEmpty().withMessage('Review title is required'),
  body('comment').trim().notEmpty().withMessage('Review comment is required'),
  body('images').optional().isArray(),
  body('orderId').optional().isMongoId().withMessage('Invalid order ID')
], reviewController.createReview);

router.get('/my-reviews', auth, reviewController.getUserReviews);
router.post('/:id/helpful', auth, reviewController.markReviewHelpful);

// Admin routes
router.get('/admin/all', [auth, admin], reviewController.getAllReviews);
router.patch('/admin/:id/status', [auth, admin], [
  body('status').isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
  body('adminReply').optional().trim()
], reviewController.updateReviewStatus);

module.exports = router;