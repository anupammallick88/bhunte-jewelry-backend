const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String, // For guest users
    sparse: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variant: {
      size: String,
      metal: String,
      gemstone: String,
      color: String
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    price: {
      type: Number,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  subtotal: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  couponCode: {
    type: String
  },
  discount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30*24*60*60*1000) // 30 days from now
  }
}, {
  timestamps: true
});

// Index for performance
cartSchema.index({ user: 1, isActive: 1 });
cartSchema.index({ sessionId: 1, isActive: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Calculate cart totals
cartSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  
  // Apply discount if coupon exists
  const discountAmount = this.couponCode ? (this.subtotal * (this.discount / 100)) : 0;
  const discountedSubtotal = this.subtotal - discountAmount;
  
  // Calculate tax (8% default)
  this.tax = discountedSubtotal * 0.08;
  
  // Calculate shipping (free over $100)
  this.shipping = discountedSubtotal >= 100 ? 0 : 10;
  
  // Calculate total
  this.total = discountedSubtotal + this.tax + this.shipping;
  
  return this;
};

module.exports = mongoose.model('Cart', cartSchema);