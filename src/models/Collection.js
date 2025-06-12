const mongoose = require('mongoose');
const slugify = require('slugify');

const collectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true
  },
  description: String,
  image: {
    url: String,
    alt: String
  },
  banner: {
    url: String,
    alt: String
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  isFeatured: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  settings: {
    showOnHomepage: {
      type: Boolean,
      default: false
    },
    layout: {
      type: String,
      enum: ['grid', 'list', 'masonry'],
      default: 'grid'
    }
  }
}, {
  timestamps: true
});

collectionSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = slugify(this.name, { lower: true });
  }
  next();
});

module.exports = mongoose.model('Collection', collectionSchema);