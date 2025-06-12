const express = require('express');
const { body } = require('express-validator');
const wishlistController = require('../controllers/wishlist');
const auth = require('../middleware/auth');

const router = express.Router();

// Public route for shared wishlists
router.get('/public/:userId', wishlistController.getPublicWishlist);

// All other routes require authentication
router.use(auth);

router.get('/', wishlistController.getWishlist);
router.get('/check/:productId', wishlistController.checkProductInWishlist);

router.post('/add', [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('variant').optional().isObject(),
  body('notes').optional().trim()
], wishlistController.addToWishlist);

router.delete('/remove/:productId', [
  body('variant').optional().isObject()
], wishlistController.removeFromWishlist);

router.put('/items/:itemId', [
  body('notes').optional().trim()
], wishlistController.updateWishlistItem);

router.delete('/clear', wishlistController.clearWishlist);

router.put('/settings', [
  body('name').optional().trim().notEmpty().withMessage('Wishlist name cannot be empty'),
  body('isPublic').optional().isBoolean()
], wishlistController.updateWishlistSettings);

module.exports = router;