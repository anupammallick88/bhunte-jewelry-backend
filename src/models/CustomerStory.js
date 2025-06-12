const mongoose = require('mongoose');
const slugify = require('slugify');

const customerStorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true
  },
  customer: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: String,
    location: String,
    socialMedia: {
      instagram: String,
      facebook: String,
      twitter: String
    }
  },
  story: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    maxlength: 300
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: String,
    caption: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  occasionType: {
    type: String,
    enum: ['Proposal', 'Wedding', 'Anniversary', 'Birthday', 'Mother\'s Day', 'Valentine\'s Day', 'Graduation', 'Promise', 'Heritage', 'Other'],
    required: true
  },
  productsPurchased: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    purchaseDate: Date,
    orderNumber: String
  }],
  submissionDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'published'],
    default: 'pending'
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  publishedDate: Date,
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  moderatorNotes: String,
  tags: [String],
  viewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

customerStorySchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = slugify(this.title, { lower: true });
  }
  if (!this.excerpt && this.story) {
    this.excerpt = this.story.substring(0, 300) + '...';
  }
  next();
});

module.exports = mongoose.model('CustomerStory', customerStorySchema);