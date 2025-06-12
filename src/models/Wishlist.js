const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    variant: {
      size: String,
      metal: String,
      gemstone: String
    },
    notes: String
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    default: 'My Wishlist'
  }
}, {
  timestamps: true
});

// Index for performance
wishlistSchema.index({ user: 1 });
wishlistSchema.index({ 'products.product': 1 });

module.exports = mongoose.model('Wishlist', wishlistSchema);