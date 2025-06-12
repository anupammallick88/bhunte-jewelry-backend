const express = require('express');
const { body } = require('express-validator');
const orderController = require('../controllers/orders');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Customer routes
router.post('/', [auth], [
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('shippingAddress').notEmpty().withMessage('Shipping address is required'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required')
], orderController.createOrder);

router.get('/my-orders', auth, orderController.getUserOrders);
router.get('/:id', auth, orderController.getOrderById);

// Admin routes
router.get('/admin/all', [auth, admin], orderController.getAllOrders);
router.put('/admin/:id/status', [auth, admin], orderController.updateOrderStatus);

module.exports = router;