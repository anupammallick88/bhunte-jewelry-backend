const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  firstName: String,
  lastName: String,
  status: {
    type: String,
    enum: ['subscribed', 'unsubscribed', 'bounced'],
    default: 'subscribed'
  },
  source: {
    type: String,
    enum: ['website', 'checkout', 'manual', 'import'],
    default: 'website'
  },
  preferences: {
    newProducts: {
      type: Boolean,
      default: true
    },
    promotions: {
      type: Boolean,
      default: true
    },
    blogPosts: {
      type: Boolean,
      default: true
    },
    customerStories: {
      type: Boolean,
      default: false
    }
  },
  tags: [String],
  lastEmailSent: Date,
  unsubscribedAt: Date,
  unsubscribeReason: String
}, {
  timestamps: true
});

// Index for performance
newsletterSchema.index({ email: 1 });
newsletterSchema.index({ status: 1 });

module.exports = mongoose.model('Newsletter', newsletterSchema);