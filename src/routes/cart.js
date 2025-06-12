const express = require('express');
const { body } = require('express-validator');
const cartController = require('../controllers/cart');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth'); // You'll need to create this

const router = express.Router();

// Cart routes (support both authenticated and guest users)
router.get('/', optionalAuth, cartController.getCart);

router.post('/add', optionalAuth, [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('variant').optional().isObject()
], cartController.addToCart);

router.put('/items/:itemId', optionalAuth, [
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], cartController.updateCartItem);

router.delete('/items/:itemId', optionalAuth, cartController.removeCartItem);
router.delete('/clear', optionalAuth, cartController.clearCart);

router.post('/apply-coupon', optionalAuth, [
  body('couponCode').trim().notEmpty().withMessage('Coupon code is required')
], cartController.applyCoupon);

router.delete('/remove-coupon', optionalAuth, cartController.removeCoupon);

// Authenticated user specific
router.post('/merge', auth, [
  body('sessionId').optional().trim()
], cartController.mergeCart);

module.exports = router;