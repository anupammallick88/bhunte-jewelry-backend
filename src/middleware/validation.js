const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Custom validation functions
const isMongoId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

const isStrongPassword = (value) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(value);
};

const isValidSlug = (value) => {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(value);
};

const isValidColor = (value) => {
  const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return colorRegex.test(value);
};

const isValidPhone = (value) => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(value);
};

const isValidUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

// Validation result handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Common validation rules
const commonValidations = {
  // MongoDB ObjectId validation
  mongoId: (field = 'id') => [
    param(field).custom(isMongoId).withMessage('Invalid ID format')
  ],

  // Email validation
  email: (field = 'email', required = true) => {
    const validation = body(field).isEmail().normalizeEmail().withMessage('Valid email is required');
    return required ? validation.notEmpty() : validation.optional();
  },

  // Password validations
  password: (field = 'password', strong = false) => {
    let validation = body(field).isLength({ min: 6 }).withMessage('Password must be at least 6 characters long');
    if (strong) {
      validation = validation.custom(isStrongPassword)
        .withMessage('Password must contain at least 8 characters with uppercase, lowercase, number and special character');
    }
    return validation;
  },

  // Name validations
  name: (field, required = true) => {
    const validation = body(field).trim().isLength({ min: 1, max: 100 }).withMessage(`${field} must be 1-100 characters`);
    return required ? validation.notEmpty() : validation.optional();
  },

  // Text validations
  text: (field, minLength = 1, maxLength = 1000, required = true) => {
    const validation = body(field).trim().isLength({ min: minLength, max: maxLength })
      .withMessage(`${field} must be ${minLength}-${maxLength} characters`);
    return required ? validation.notEmpty() : validation.optional();
  },

  // Number validations
  number: (field, min = 0, max = null, required = true) => {
    let validation = body(field).isNumeric().withMessage(`${field} must be a number`);
    if (min !== null) validation = validation.isFloat({ min }).withMessage(`${field} must be at least ${min}`);
    if (max !== null) validation = validation.isFloat({ max }).withMessage(`${field} must be at most ${max}`);
    return required ? validation.notEmpty() : validation.optional();
  },

  // Boolean validation
  boolean: (field, required = false) => {
    const validation = body(field).isBoolean().withMessage(`${field} must be true or false`);
    return required ? validation.notEmpty() : validation.optional();
  },

  // Array validation
  array: (field, minLength = 0, maxLength = null, required = true) => {
    let validation = body(field).isArray({ min: minLength }).withMessage(`${field} must be an array with at least ${minLength} items`);
    if (maxLength) validation = validation.isArray({ max: maxLength }).withMessage(`${field} can have at most ${maxLength} items`);
    return required ? validation.notEmpty() : validation.optional();
  },

  // URL validation
  url: (field, required = false) => {
    const validation = body(field).custom(isValidUrl).withMessage(`${field} must be a valid URL`);
    return required ? validation.notEmpty() : validation.optional();
  },

  // Date validation
  date: (field, required = false) => {
    const validation = body(field).isISO8601().withMessage(`${field} must be a valid date`);
    return required ? validation.notEmpty() : validation.optional();
  },

  // Phone validation
  phone: (field, required = false) => {
    const validation = body(field).custom(isValidPhone).withMessage(`${field} must be a valid phone number`);
    return required ? validation.notEmpty() : validation.optional();
  },

  // Slug validation
  slug: (field, required = false) => {
    const validation = body(field).custom(isValidSlug).withMessage(`${field} must be a valid slug (lowercase, numbers, hyphens only)`);
    return required ? validation.notEmpty() : validation.optional();
  },

  // Color validation
  color: (field, required = false) => {
    const validation = body(field).custom(isValidColor).withMessage(`${field} must be a valid hex color`);
    return required ? validation.notEmpty() : validation.optional();
  }
};

// Specific validation schemas for different entities

// User validations
const userValidations = {
  register: [
    commonValidations.name('firstName'),
    commonValidations.name('lastName'),
    commonValidations.email('email'),
    commonValidations.password('password', true),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
    commonValidations.phone('phone', false),
    handleValidationErrors
  ],

  login: [
    commonValidations.email('email'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors
  ],

  updateProfile: [
    commonValidations.name('firstName', false),
    commonValidations.name('lastName', false),
    commonValidations.phone('phone', false),
    commonValidations.date('dateOfBirth', false),
    handleValidationErrors
  ],

  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    commonValidations.password('newPassword', true),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),
    handleValidationErrors
  ],

  addAddress: [
    body('type').isIn(['shipping', 'billing']).withMessage('Address type must be shipping or billing'),
    commonValidations.name('firstName'),
    commonValidations.name('lastName'),
    body('company').optional().trim(),
    commonValidations.text('address1', 1, 200),
    body('address2').optional().trim().isLength({ max: 200 }),
    commonValidations.text('city', 1, 100),
    commonValidations.text('state', 1, 100),
    commonValidations.text('zipCode', 1, 20),
    commonValidations.text('country', 1, 100),
    commonValidations.phone('phone', false),
    commonValidations.boolean('isDefault', false),
    handleValidationErrors
  ]
};

// Product validations
const productValidations = {
  create: [
    commonValidations.text('name', 1, 200),
    commonValidations.text('description', 10, 5000),
    body('shortDescription').optional().trim().isLength({ max: 200 }),
    commonValidations.text('sku', 1, 50),
    body('category').custom(isMongoId).withMessage('Valid category ID is required'),
    body('subcategory').optional().custom(isMongoId).withMessage('Invalid subcategory ID'),
    commonValidations.number('price', 0.01),
    commonValidations.number('comparePrice', 0, null, false),
    commonValidations.number('costPrice', 0, null, false),
    body('inventory.quantity').isInt({ min: 0 }).withMessage('Inventory quantity must be a non-negative integer'),
    body('inventory.lowStockThreshold').optional().isInt({ min: 0 }),
    commonValidations.array('tags', 0, 20, false),
    commonValidations.array('collections', 0, 10, false),
    commonValidations.boolean('isActive', false),
    commonValidations.boolean('isFeatured', false),
    commonValidations.boolean('isNew', false),
    handleValidationErrors
  ],

  update: [
    commonValidations.text('name', 1, 200, false),
    commonValidations.text('description', 10, 5000, false),
    body('shortDescription').optional().trim().isLength({ max: 200 }),
    body('category').optional().custom(isMongoId).withMessage('Invalid category ID'),
    body('subcategory').optional().custom(isMongoId).withMessage('Invalid subcategory ID'),
    commonValidations.number('price', 0.01, null, false),
    commonValidations.number('comparePrice', 0, null, false),
    commonValidations.number('costPrice', 0, null, false),
    body('inventory.quantity').optional().isInt({ min: 0 }),
    body('inventory.lowStockThreshold').optional().isInt({ min: 0 }),
    commonValidations.array('tags', 0, 20, false),
    commonValidations.array('collections', 0, 10, false),
    commonValidations.boolean('isActive', false),
    commonValidations.boolean('isFeatured', false),
    commonValidations.boolean('isNew', false),
    handleValidationErrors
  ]
};

// Order validations
const orderValidations = {
  create: [
    commonValidations.array('items', 1, 20),
    body('items.*.productId').custom(isMongoId).withMessage('Valid product ID is required for each item'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
    body('items.*.variant').optional().isObject(),
    body('shippingAddress').isObject().withMessage('Shipping address is required'),
    body('shippingAddress.firstName').trim().notEmpty().withMessage('Shipping first name is required'),
    body('shippingAddress.lastName').trim().notEmpty().withMessage('Shipping last name is required'),
    body('shippingAddress.address1').trim().notEmpty().withMessage('Shipping address is required'),
    body('shippingAddress.city').trim().notEmpty().withMessage('Shipping city is required'),
    body('shippingAddress.state').trim().notEmpty().withMessage('Shipping state is required'),
    body('shippingAddress.zipCode').trim().notEmpty().withMessage('Shipping zip code is required'),
    body('shippingAddress.country').trim().notEmpty().withMessage('Shipping country is required'),
    body('billingAddress').optional().isObject(),
    body('paymentMethod').isIn(['paypal', 'stripe', 'bank_transfer']).withMessage('Invalid payment method'),
    body('couponCode').optional().trim(),
    body('notes').optional().trim().isLength({ max: 500 }),
    handleValidationErrors
  ]
};

// Review validations
const reviewValidations = {
  create: [
    body('productId').custom(isMongoId).withMessage('Valid product ID is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    commonValidations.text('title', 1, 100),
    commonValidations.text('comment', 1, 1000),
    body('images').optional().isArray({ max: 5 }).withMessage('Maximum 5 images allowed'),
    body('orderId').optional().custom(isMongoId).withMessage('Invalid order ID'),
    handleValidationErrors
  ]
};

// Blog validations
const blogValidations = {
  create: [
    commonValidations.text('title', 1, 200),
    commonValidations.text('content', 10, 50000),
    commonValidations.text('category', 1, 100),
    body('excerpt').optional().trim().isLength({ max: 300 }),
    commonValidations.array('tags', 0, 20, false),
    body('status').optional().isIn(['draft', 'published', 'archived']),
    commonValidations.date('publishedDate', false),
    handleValidationErrors
  ]
};

// Category validations
const categoryValidations = {
  create: [
    commonValidations.text('name', 1, 100),
    body('description').optional().trim().isLength({ max: 1000 }),
    commonValidations.slug('slug', false),
    body('parent').optional().custom(isMongoId).withMessage('Invalid parent category ID'),
    commonValidations.number('sortOrder', 0, null, false),
    commonValidations.boolean('isActive', false),
    commonValidations.boolean('isFeatured', false),
    handleValidationErrors
  ]
};

// Collection validations
const collectionValidations = {
  create: [
    commonValidations.text('name', 1, 100),
    body('description').optional().trim().isLength({ max: 1000 }),
    commonValidations.slug('slug', false),
    commonValidations.boolean('isFeatured', false),
    commonValidations.boolean('isActive', false),
    commonValidations.number('sortOrder', 0, null, false),
    body('settings.showOnHomepage').optional().isBoolean(),
    body('settings.layout').optional().isIn(['grid', 'list', 'masonry']),
    handleValidationErrors
  ]
};

// Content validations
const contentValidations = {
  create: [
    body('type').isIn(['hero', 'banner', 'menu', 'page', 'block', 'announcement']).withMessage('Invalid content type'),
    commonValidations.text('name', 1, 200),
    body('content').notEmpty().withMessage('Content data is required'),
    body('position').optional().trim(),
    commonValidations.number('displayOrder', 0, null, false),
    commonValidations.boolean('isActive', false),
    commonValidations.date('startDate', false),
    commonValidations.date('endDate', false),
    body('targetAudience').optional().isIn(['all', 'new_visitors', 'returning_customers', 'vip_customers']),
    handleValidationErrors
  ]
};

// Newsletter validations
const newsletterValidations = {
  subscribe: [
    commonValidations.email('email'),
    commonValidations.name('firstName', false),
    commonValidations.name('lastName', false),
    body('preferences').optional().isObject(),
    body('source').optional().isIn(['website', 'checkout', 'manual', 'import']),
    handleValidationErrors
  ]
};

// Query parameter validations
const queryValidations = {
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    handleValidationErrors
  ],

  search: [
    query('q').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be 1-100 characters'),
    handleValidationErrors
  ],

  dateRange: [
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format for dateFrom'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format for dateTo'),
    handleValidationErrors
  ]
};

module.exports = {
  commonValidations,
  userValidations,
  productValidations,
  orderValidations,
  reviewValidations,
  blogValidations,
  categoryValidations,
  collectionValidations,
  contentValidations,
  newsletterValidations,
  queryValidations,
  handleValidationErrors,
  // Custom validators
  isMongoId,
  isStrongPassword,
  isValidSlug,
  isValidColor,
  isValidPhone,
  isValidUrl
};