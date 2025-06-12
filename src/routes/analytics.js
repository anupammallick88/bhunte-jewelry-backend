const express = require('express');
const { body } = require('express-validator');
const analyticsController = require('../controllers/analytics');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Public route for tracking events
router.post('/track', [
  body('type').isIn(['page_view', 'product_view', 'cart_add', 'cart_remove', 'checkout_start', 'purchase', 'search', 'newsletter_signup'])
    .withMessage('Invalid event type'),
  body('productId').optional().isMongoId().withMessage('Invalid product ID'),
  body('orderId').optional().isMongoId().withMessage('Invalid order ID')
], analyticsController.trackEvent);

// Admin routes - all require authentication and admin role
router.get('/admin/dashboard', [auth, admin], analyticsController.getDashboardAnalytics);
router.get('/admin/products', [auth, admin], analyticsController.getProductAnalytics);
router.get('/admin/users', [auth, admin], analyticsController.getUserAnalytics);
router.get('/admin/realtime', [auth, admin], analyticsController.getRealtimeAnalytics);
router.get('/admin/export', [auth, admin], analyticsController.exportAnalytics);

module.exports = router;