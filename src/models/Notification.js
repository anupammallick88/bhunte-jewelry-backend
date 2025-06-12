const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['order_update', 'customer_story_submitted', 'review_submitted', 'low_inventory', 'new_customer', 'system'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  recipientType: {
    type: String,
    enum: ['admin', 'customer', 'all_admins'],
    default: 'admin'
  },
  data: mongoose.Schema.Types.Mixed, // Additional notification data
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  actionUrl: String, // URL to navigate when notification is clicked
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  }
}, {
  timestamps: true
});

// Index for performance
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);