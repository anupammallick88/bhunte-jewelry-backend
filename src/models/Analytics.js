const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['page_view', 'product_view', 'cart_add', 'cart_remove', 'checkout_start', 'purchase', 'search', 'newsletter_signup'],
    required: true
  },
  sessionId: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  page: String,
  referrer: String,
  userAgent: String,
  ipAddress: String,
  data: mongoose.Schema.Types.Mixed, // Additional event data
  revenue: Number, // For purchase events
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for performance and analytics queries
analyticsSchema.index({ type: 1, timestamp: -1 });
analyticsSchema.index({ userId: 1, timestamp: -1 });
analyticsSchema.index({ productId: 1, type: 1 });
analyticsSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);