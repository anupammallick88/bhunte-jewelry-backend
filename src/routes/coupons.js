const express = require('express');
const { body } = require('express-validator');
const couponController = require('../controllers/coupon');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();

// Public route for coupon validation
router.post('/validate', optionalAuth, [
  body('code').trim().notEmpty().withMessage('Coupon code is required'),
  body('orderAmount').optional().isNumeric().withMessage('Order amount must be numeric'),
  body('userId').optional().isMongoId().withMessage('Invalid user ID')
], couponController.validateCoupon);

// Admin routes
router.get('/admin/all', [auth, admin], couponController.getAllCoupons);
router.get('/admin/:id/stats', [auth, admin], couponController.getCouponStats);

router.post('/admin/create', [auth, admin], [
  body('code').trim().notEmpty().withMessage('Coupon code is required'),
  body('name').trim().notEmpty().withMessage('Coupon name is required'),
  body('type').isIn(['percentage', 'fixed', 'free_shipping']).withMessage('Invalid coupon type'),
  body('value').isNumeric().withMessage('Coupon value must be numeric'),
  body('minimumOrderAmount').optional().isNumeric(),
  body('maximumDiscountAmount').optional().isNumeric(),
  body('usageLimit').optional().isInt({ min: 1 }),
  body('userUsageLimit').optional().isInt({ min: 1 }),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('startDate').optional().isISO8601()
], couponController.createCoupon);

router.put('/admin/:id', [auth, admin], [
  body('code').optional().trim().notEmpty().withMessage('Coupon code cannot be empty'),
  body('name').optional().trim().notEmpty().withMessage('Coupon name cannot be empty'),
  body('type').optional().isIn(['percentage', 'fixed', 'free_shipping']).withMessage('Invalid coupon type'),
  body('value').optional().isNumeric().withMessage('Coupon value must be numeric'),
  body('minimumOrderAmount').optional().isNumeric(),
  body('maximumDiscountAmount').optional().isNumeric(),
  body('usageLimit').optional().isInt({ min: 1 }),
  body('userUsageLimit').optional().isInt({ min: 1 }),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
  body('startDate').optional().isISO8601()
], couponController.updateCoupon);

router.delete('/admin/:id', [auth, admin], couponController.deleteCoupon);
router.patch('/admin/:id/toggle-status', [auth, admin], couponController.toggleCouponStatus);

module.exports = router;