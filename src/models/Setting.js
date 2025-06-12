const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: mongoose.Schema.Types.Mixed,
  type: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'payment', 'shipping', 'email', 'seo', 'social', 'appearance'],
    required: true
  },
  description: String,
  isPublic: {
    type: Boolean,
    default: false // Whether this setting can be accessed by frontend
  }
}, {
  timestamps: true
});

// Index for performance
settingSchema.index({ category: 1 });
settingSchema.index({ key: 1 });

module.exports = mongoose.model('Setting', settingSchema);