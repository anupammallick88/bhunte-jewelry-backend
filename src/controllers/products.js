const Product = require('../models/Product');
const Category = require('../models/Category');
const Collection = require('../models/Collection');
const Review = require('../models/Review');
const Analytics = require('../models/Analytics');
const { validationResult } = require('express-validator');
const slugify = require('slugify');

// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public
exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      subcategory,
      collection,
      minPrice,
      maxPrice,
      sort = '-createdAt',
      search,
      tags,
      featured,
      isNew,
      metal,
      gemstone,
      size,
      inStock,
      rating
    } = req.query;

    // Build query object
    const query = { isActive: true };

    // Filter by category
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        // Find category by slug
        const categoryDoc = await Category.findOne({ slug: category, isActive: true });
        if (categoryDoc) {
          query.category = categoryDoc._id;
        }
      }
    }

    // Filter by subcategory
    if (subcategory) {
      if (mongoose.Types.ObjectId.isValid(subcategory)) {
        query.subcategory = subcategory;
      } else {
        const subcategoryDoc = await Category.findOne({ slug: subcategory, isActive: true });
        if (subcategoryDoc) {
          query.subcategory = subcategoryDoc._id;
        }
      }
    }

    // Filter by collection
    if (collection) {
      query.collections = { $in: [collection] };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',');
      query.tags = { $in: tagArray };
    }

    // Featured filter
    if (featured === 'true') {
      query.isFeatured = true;
    }

    // New products filter
    if (isNew === 'true') {
      query.isNew = true;
    }

    // Metal filter
    if (metal) {
      query['attributes.metal'] = { $regex: metal, $options: 'i' };
    }

    // Gemstone filter
    if (gemstone) {
      query['attributes.gemstone'] = { $regex: gemstone, $options: 'i' };
    }

    // Size filter (for rings mainly)
    if (size) {
      query['variants.options.name'] = size;
    }

    // In stock filter
    if (inStock === 'true') {
      query['inventory.quantity'] = { $gt: 0 };
    }

    // Rating filter
    if (rating) {
      query.averageRating = { $gte: Number(rating) };
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'price_asc':
        sortObj = { price: 1 };
        break;
      case 'price_desc':
        sortObj = { price: -1 };
        break;
      case 'name_asc':
        sortObj = { name: 1 };
        break;
      case 'name_desc':
        sortObj = { name: -1 };
        break;
      case 'rating':
        sortObj = { averageRating: -1 };
        break;
      case 'popular':
        sortObj = { soldCount: -1 };
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'oldest':
        sortObj = { createdAt: 1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const products = await Product.find(query)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('collections', 'name slug')
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const currentPage = parseInt(page);

    res.json({
      success: true,
      count: products.length,
      total,
      products,
      pagination: {
        currentPage,
        totalPages,
        totalProducts: total,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        prevPage: currentPage > 1 ? currentPage - 1 : null
      }
    });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('collections', 'name slug');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment view count
    await Product.findByIdAndUpdate(req.params.id, {
      $inc: { viewCount: 1 }
    });

    // Track analytics if user provided
    if (req.ip) {
      await Analytics.create({
        type: 'product_view',
        productId: product._id,
        userId: req.user ? req.user.id : null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        data: {
          productName: product.name,
          category: product.category.name
        }
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Error in getProductById:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single product by slug
// @route   GET /api/products/slug/:slug
// @access  Public
exports.getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true })
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('collections', 'name slug');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment view count
    await Product.findByIdAndUpdate(product._id, {
      $inc: { viewCount: 1 }
    });

    // Get related products
    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category._id,
      isActive: true
    })
    .limit(4)
    .select('name slug price images averageRating reviewCount')
    .lean();

    // Track analytics
    if (req.ip) {
      await Analytics.create({
        type: 'product_view',
        productId: product._id,
        userId: req.user ? req.user.id : null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        data: {
          productName: product.name,
          category: product.category.name
        }
      });
    }

    res.json({
      success: true,
      product,
      relatedProducts
    });
  } catch (error) {
    console.error('Error in getProductBySlug:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get product reviews
// @route   GET /api/products/:id/reviews
// @access  Public
exports.getProductReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({
      product: req.params.id,
      status: 'approved'
    })
    .populate('user', 'firstName lastName')
    .sort(sort)
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

    const total = await Review.countDocuments({
      product: req.params.id,
      status: 'approved'
    });

    // Get review statistics
    const reviewStats = await Review.aggregate([
      { $match: { product: mongoose.Types.ObjectId(req.params.id), status: 'approved' } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]);

    const ratingDistribution = {
      5: 0, 4: 0, 3: 0, 2: 0, 1: 0
    };

    reviewStats.forEach(stat => {
      ratingDistribution[stat._id] = stat.count;
    });

    res.json({
      success: true,
      reviews,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit)
      },
      ratingDistribution
    });
  } catch (error) {
    console.error('Error in getProductReviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Generate slug if not provided
    if (!req.body.slug) {
      req.body.slug = slugify(req.body.name, { lower: true });
    }

    // Check if slug already exists
    const existingProduct = await Product.findOne({ slug: req.body.slug });
    if (existingProduct) {
      req.body.slug = `${req.body.slug}-${Date.now()}`;
    }

    // Check if SKU already exists
    const existingSKU = await Product.findOne({ sku: req.body.sku });
    if (existingSKU) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists'
      });
    }

    const product = new Product(req.body);
    await product.save();

    // Populate the saved product
    await product.populate('category subcategory collections');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Error in createProduct:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // If name is being updated, regenerate slug
    if (req.body.name && !req.body.slug) {
      req.body.slug = slugify(req.body.name, { lower: true });
      
      // Check if new slug conflicts
      const existingProduct = await Product.findOne({ 
        slug: req.body.slug,
        _id: { $ne: req.params.id }
      });
      
      if (existingProduct) {
        req.body.slug = `${req.body.slug}-${Date.now()}`;
      }
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    ).populate('category subcategory collections');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Error in updateProduct:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product has orders (you might want to soft delete instead)
    // const hasOrders = await Order.findOne({ 'items.product': req.params.id });
    // if (hasOrders) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Cannot delete product with existing orders. Consider deactivating instead.'
    //   });
    // }

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Toggle product active status
// @route   PATCH /api/products/:id/toggle-status
// @access  Private/Admin
exports.toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.json({
      success: true,
      message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
      product: {
        id: product._id,
        name: product.name,
        isActive: product.isActive
      }
    });
  } catch (error) {
    console.error('Error in toggleProductStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update product inventory
// @route   PATCH /api/products/:id/inventory
// @access  Private/Admin
exports.updateProductInventory = async (req, res) => {
  try {
    const { quantity, lowStockThreshold } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        'inventory.quantity': quantity,
        'inventory.lowStockThreshold': lowStockThreshold || product.inventory.lowStockThreshold
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Inventory updated successfully',
      inventory: product.inventory
    });
  } catch (error) {
    console.error('Error in updateProductInventory:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
exports.getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const products = await Product.find({
      isFeatured: true,
      isActive: true
    })
    .populate('category', 'name slug')
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .lean();

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Error in getFeaturedProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get new arrival products
// @route   GET /api/products/new-arrivals
// @access  Public
exports.getNewArrivals = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const products = await Product.find({
      isNew: true,
      isActive: true
    })
    .populate('category', 'name slug')
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .lean();

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Error in getNewArrivals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get best selling products
// @route   GET /api/products/best-sellers
// @access  Public
exports.getBestSellers = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const products = await Product.find({
      isActive: true,
      soldCount: { $gt: 0 }
    })
    .populate('category', 'name slug')
    .limit(parseInt(limit))
    .sort({ soldCount: -1 })
    .lean();

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Error in getBestSellers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
exports.searchProducts = async (req, res) => {
  try {
    const { q, page = 1, limit = 12 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const skip = (page - 1) * limit;

    // Create search query
    const searchQuery = {
      isActive: true,
      $text: { $search: q }
    };

    const products = await Product.find(searchQuery)
      .populate('category', 'name slug')
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Product.countDocuments(searchQuery);

    // Track search analytics
    if (req.ip) {
      await Analytics.create({
        type: 'search',
        userId: req.user ? req.user.id : null,
        ipAddress: req.ip,
        data: {
          searchQuery: q,
          resultsCount: total
        }
      });
    }

    res.json({
      success: true,
      query: q,
      count: products.length,
      total,
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in searchProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:categorySlug
// @access  Public
exports.getProductsByCategory = async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const { page = 1, limit = 12, sort = '-createdAt' } = req.query;

    // Find category by slug
    const category = await Category.findOne({ 
      slug: categorySlug, 
      isActive: true 
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const skip = (page - 1) * limit;

    const products = await Product.find({
      category: category._id,
      isActive: true
    })
    .populate('category', 'name slug')
    .populate('subcategory', 'name slug')
    .sort(sort)
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

    const total = await Product.countDocuments({
      category: category._id,
      isActive: true
    });

    res.json({
      success: true,
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description
      },
      count: products.length,
      total,
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getProductsByCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};