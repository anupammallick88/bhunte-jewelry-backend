const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const Analytics = require('../models/Analytics');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');
const paymentService = require('../services/paymentService');
const emailService = require('../services/emailService');
const shippingService = require('../services/shippingService');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { 
      items, 
      shippingAddress, 
      billingAddress, 
      paymentMethod, 
      couponCode,
      shippingMethod,
      notes 
    } = req.body;

    // Validate and process order items
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      if (!product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" is not available`
        });
      }

      // Check inventory
      if (product.inventory.trackQuantity) {
        if (product.inventory.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${product.name}". Available: ${product.inventory.quantity}, Requested: ${item.quantity}`
          });
        }
      }

      const itemPrice = product.price;
      const totalPrice = itemPrice * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: itemPrice,
        totalPrice,
        variant: item.variant || {}
      });
    }

    // Apply coupon if provided
    let discount = 0;
    let couponDiscount = 0;
    
    if (couponCode) {
      const coupon = await Coupon.findOne({ 
        code: couponCode.toUpperCase(),
        isActive: true 
      });

      if (!coupon || !coupon.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired coupon code'
        });
      }

      if (!coupon.canUserUse(req.user.id)) {
        return res.status(400).json({
          success: false,
          message: 'You have already used this coupon'
        });
      }

      if (subtotal < coupon.minimumOrderAmount) {
        return res.status(400).json({
          success: false,
          message: `Minimum order amount for this coupon is $${coupon.minimumOrderAmount}`
        });
      }

      // Calculate discount
      if (coupon.type === 'percentage') {
        couponDiscount = (subtotal * coupon.value) / 100;
        if (coupon.maximumDiscountAmount) {
          couponDiscount = Math.min(couponDiscount, coupon.maximumDiscountAmount);
        }
      } else if (coupon.type === 'fixed') {
        couponDiscount = Math.min(coupon.value, subtotal);
      }

      discount = couponDiscount;
    }

    // Calculate shipping
    let shippingCost = 0;
    if (shippingMethod) {
      try {
        const shippingRate = await shippingService.calculateShipping({
          address: shippingAddress,
          items: orderItems,
          method: shippingMethod
        });
        shippingCost = shippingRate.cost;
      } catch (error) {
        console.error('Shipping calculation error:', error);
        // Fallback shipping calculation
        shippingCost = (subtotal - discount) >= 100 ? 0 : 10;
      }
    } else {
      // Default shipping calculation
      shippingCost = (subtotal - discount) >= 100 ? 0 : 10;
    }

    // Calculate tax (8% default, can be customized based on location)
    const taxableAmount = subtotal - discount;
    const tax = Math.max(0, taxableAmount * 0.08);

    // Calculate total
    const total = subtotal - discount + shippingCost + tax;

    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create order
    const order = new Order({
      orderNumber,
      customer: req.user.id,
      items: orderItems,
      shippingAddress,
      billingAddress,
      subtotal,
      shippingCost,
      tax,
      discount,
      total,
      paymentMethod,
      couponCode: couponCode || undefined,
      couponDiscount,
      shippingMethod: shippingMethod ? {
        name: shippingMethod.name,
        cost: shippingCost,
        estimatedDays: shippingMethod.estimatedDays
      } : undefined,
      notes
    });

    await order.save();

    // Process payment
    try {
      const paymentResult = await paymentService.processPayment({
        amount: total,
        currency: 'USD',
        paymentMethod,
        orderId: order._id,
        customerEmail: req.user.email,
        billingAddress
      });

      if (paymentResult.success) {
        order.status = 'paid';
        order.paymentStatus = 'paid';
        order.paymentDetails = {
          transactionId: paymentResult.transactionId,
          paymentId: paymentResult.paymentId,
          gatewayResponse: paymentResult.details
        };

        // Update product inventory and sales count
        for (const item of orderItems) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { 
              'inventory.quantity': -item.quantity,
              soldCount: item.quantity
            }
          });
        }

        // Update coupon usage
        if (couponCode) {
          const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
          if (coupon) {
            coupon.usageCount += 1;
            coupon.usedBy.push({
              user: req.user.id,
              order: order._id
            });
            await coupon.save();
          }
        }

        // Clear user's cart
        await Cart.findOneAndUpdate(
          { user: req.user.id, isActive: true },
          { isActive: false }
        );

        await order.save();

        // Send order confirmation email
        try {
          await emailService.sendOrderConfirmation(req.user.email, order);
        } catch (emailError) {
          console.error('Email sending error:', emailError);
          // Don't fail the order if email fails
        }

        // Create admin notification
        await Notification.create({
          type: 'new_order',
          title: 'New Order Received',
          message: `Order ${order.orderNumber} for $${total.toFixed(2)} has been placed`,
          recipientType: 'all_admins',
          actionUrl: `/admin/orders/${order._id}`,
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: `${req.user.firstName} ${req.user.lastName}`,
            total: total
          }
        });

        // Track analytics
        await Analytics.create({
          type: 'purchase',
          userId: req.user.id,
          orderId: order._id,
          revenue: total,
          data: {
            orderNumber: order.orderNumber,
            itemCount: orderItems.length,
            paymentMethod,
            couponUsed: !!couponCode
          }
        });

        res.status(201).json({
          success: true,
          message: 'Order created successfully',
          order: {
            id: order._id,
            orderNumber: order.orderNumber,
            total: order.total,
            status: order.status,
            paymentStatus: order.paymentStatus
          }
        });
      } else {
        order.status = 'cancelled';
        order.paymentStatus = 'failed';
        order.paymentDetails = {
          error: paymentResult.error,
          gatewayResponse: paymentResult.details
        };
        await order.save();

        res.status(400).json({
          success: false,
          message: 'Payment failed',
          error: paymentResult.error
        });
      }
    } catch (paymentError) {
      console.error('Payment processing error:', paymentError);
      
      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      await order.save();

      res.status(500).json({
        success: false,
        message: 'Payment processing failed',
        error: paymentError.message
      });
    }

  } catch (error) {
    console.error('Error in createOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get user's orders
// @route   GET /api/orders/my-orders
// @access  Private
exports.getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = { customer: req.user.id };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('items.product', 'name images slug price')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        hasNextPage: page < Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getUserOrders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      customer: req.user.id
    })
    .populate('items.product', 'name images slug price attributes')
    .populate('customer', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error in getOrderById:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      customer: req.user.id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be cancelled
    if (!['pending', 'paid', 'processing'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    const { reason } = req.body;

    // Update order status
    order.status = 'cancelled';
    order.notes = order.notes ? `${order.notes}\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`;
    
    // Restore inventory
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 
          'inventory.quantity': item.quantity,
          soldCount: -item.quantity
        }
      });
    }

    // Process refund if payment was completed
    if (order.paymentStatus === 'paid') {
      try {
        const refundResult = await paymentService.processRefund({
          transactionId: order.paymentDetails.transactionId,
          amount: order.total,
          reason: reason
        });

        if (refundResult.success) {
          order.paymentStatus = 'refunded';
        }
      } catch (refundError) {
        console.error('Refund processing error:', refundError);
        // Continue with cancellation even if refund fails
      }
    }

    await order.save();

    // Send cancellation email
    try {
      await emailService.sendOrderCancellation(req.user.email, order, reason);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    // Create admin notification
    await Notification.create({
      type: 'order_cancelled',
      title: 'Order Cancelled',
      message: `Order ${order.orderNumber} has been cancelled by customer`,
      recipientType: 'all_admins',
      actionUrl: `/admin/orders/${order._id}`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        reason: reason
      }
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders/admin/all
// @access  Private/Admin
exports.getAllOrders = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      paymentStatus,
      dateFrom,
      dateTo,
      search 
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.firstName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.lastName': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate('customer', 'firstName lastName email')
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Order.countDocuments(query);

    // Get order statistics
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$total' }
        }
      }
    ]);

    res.json({
      success: true,
      orders,
      total,
      stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllOrders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single order (Admin)
// @route   GET /api/orders/admin/:id
// @access  Private/Admin
exports.getOrderByIdAdmin = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'firstName lastName email phone')
      .populate('items.product', 'name images slug price sku attributes');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error in getOrderByIdAdmin:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update order status (Admin)
// @route   PATCH /api/orders/admin/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber, notes } = req.body;

    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    const order = await Order.findById(req.params.id)
      .populate('customer', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const oldStatus = order.status;
    order.status = status;
    
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }
    
    if (notes) {
      order.notes = order.notes ? `${order.notes}\n${notes}` : notes;
    }

    await order.save();

    // Send status update email to customer
    try {
      await emailService.sendOrderStatusUpdate(order.customer.email, order, oldStatus);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    // Create customer notification
    await Notification.create({
      type: 'order_update',
      title: 'Order Status Updated',
      message: `Your order ${order.orderNumber} status has been updated to ${status}`,
      recipient: order.customer._id,
      recipientType: 'customer',
      actionUrl: `/orders/${order._id}`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        newStatus: status,
        oldStatus: oldStatus
      }
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        trackingNumber: order.trackingNumber
      }
    });
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get order statistics (Admin)
// @route   GET /api/orders/admin/statistics
// @access  Private/Admin
exports.getOrderStatistics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get order statistics
    const stats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          completedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['delivered', 'completed']] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get daily revenue for the period
    const dailyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Get top selling products
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          productImage: { $arrayElemAt: ['$product.images.url', 0] },
          totalSold: 1,
          totalRevenue: 1
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      period,
      statistics: stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        pendingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0
      },
      dailyRevenue,
      topProducts
    });
  } catch (error) {
    console.error('Error in getOrderStatistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Export orders (Admin)
// @route   GET /api/orders/admin/export
// @access  Private/Admin
exports.exportOrders = async (req, res) => {
  try {
    const { 
      format = 'csv',
      dateFrom,
      dateTo,
      status 
    } = req.query;

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const orders = await Order.find(query)
      .populate('customer', 'firstName lastName email')
      .populate('items.product', 'name sku')
      .sort({ createdAt: -1 })
      .lean();

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = orders.map(order => ({
        'Order Number': order.orderNumber,
        'Customer Name': `${order.customer?.firstName} ${order.customer?.lastName}`,
        'Customer Email': order.customer?.email,
        'Status': order.status,
        'Payment Status': order.paymentStatus,
        'Total': order.total,
        'Items': order.items.map(item => `${item.product?.name} (x${item.quantity})`).join('; '),
        'Created At': order.createdAt.toISOString(),
        'Shipping Address': `${order.shippingAddress?.address1}, ${order.shippingAddress?.city}, ${order.shippingAddress?.state} ${order.shippingAddress?.zipCode}`
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`);
      
      // Simple CSV conversion (you might want to use a proper CSV library)
      const csvHeaders = Object.keys(csvData[0] || {}).join(',');
      const csvRows = csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','));
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      
      res.send(csvContent);
    } else {
      // Return JSON
      res.json({
        success: true,
        count: orders.length,
        orders
      });
    }
  } catch (error) {
    console.error('Error in exportOrders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};