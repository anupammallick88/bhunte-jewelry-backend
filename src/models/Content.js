const mongoose = require('mongoose');
const slugify = require('slugify');

const contentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['hero', 'banner', 'menu', 'page', 'block', 'announcement'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    unique: true
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  position: String, // For banners: 'header', 'footer', 'sidebar', 'category', etc.
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: Date,
  endDate: Date,
  targetAudience: {
    type: String,
    enum: ['all', 'new_visitors', 'returning_customers', 'vip_customers'],
    default: 'all'
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  }
}, {
  timestamps: true
});

contentSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = slugify(this.name, { lower: true });
  }
  next();
});

// Index for performance
contentSchema.index({ type: 1, isActive: 1, displayOrder: 1 });
contentSchema.index({ position: 1, isActive: 1 });

module.exports = mongoose.model('Content', contentSchema);