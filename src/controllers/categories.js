const Category = require('../models/Category');
const Product = require('../models/Product');
const { validationResult } = require('express-validator');
const slugify = require('slugify');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getAllCategories = async (req, res) => {
  try {
    const { includeInactive = false, level } = req.query;

    // Build query
    const query = {};
    if (!includeInactive) {
      query.isActive = true;
    }
    if (level !== undefined) {
      query.level = parseInt(level);
    }

    const categories = await Category.find(query)
      .populate('parent', 'name slug')
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .lean();

    // Build hierarchical structure
    const categoryMap = new Map();
    const rootCategories = [];

    // First pass: create map
    categories.forEach(category => {
      categoryMap.set(category._id.toString(), {
        ...category,
        children: []
      });
    });

    // Second pass: build hierarchy
    categories.forEach(category => {
      if (category.parent) {
        const parent = categoryMap.get(category.parent._id.toString());
        if (parent) {
          parent.children.push(categoryMap.get(category._id.toString()));
        }
      } else {
        rootCategories.push(categoryMap.get(category._id.toString()));
      }
    });

    res.json({
      success: true,
      count: categories.length,
      categories: rootCategories
    });
  } catch (error) {
    console.error('Error in getAllCategories:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get category by ID
// @route   GET /api/categories/:id
// @access  Public
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name slug');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get subcategories
    const subcategories = await Category.find({ 
      parent: category._id, 
      isActive: true 
    }).sort({ sortOrder: 1, name: 1 });

    // Get product count
    const productCount = await Product.countDocuments({ 
      category: category._id, 
      isActive: true 
    });

    res.json({
      success: true,
      category: {
        ...category.toObject(),
        subcategories,
        productCount
      }
    });
  } catch (error) {
    console.error('Error in getCategoryById:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get category by slug
// @route   GET /api/categories/slug/:slug
// @access  Public
exports.getCategoryBySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ 
      slug: req.params.slug, 
      isActive: true 
    }).populate('parent', 'name slug');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get subcategories
    const subcategories = await Category.find({ 
      parent: category._id, 
      isActive: true 
    }).sort({ sortOrder: 1, name: 1 });

    // Get product count
    const productCount = await Product.countDocuments({ 
      category: category._id, 
      isActive: true 
    });

    res.json({
      success: true,
      category: {
        ...category.toObject(),
        subcategories,
        productCount
      }
    });
  } catch (error) {
    console.error('Error in getCategoryBySlug:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private/Admin
exports.createCategory = async (req, res) => {
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
    const existingCategory = await Category.findOne({ slug: req.body.slug });
    if (existingCategory) {
      req.body.slug = `${req.body.slug}-${Date.now()}`;
    }

    // Set level based on parent
    if (req.body.parent) {
      const parentCategory = await Category.findById(req.body.parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }
      req.body.level = parentCategory.level + 1;
    } else {
      req.body.level = 0;
    }

    const category = new Category(req.body);
    await category.save();

    // Populate the saved category
    await category.populate('parent', 'name slug');

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    console.error('Error in createCategory:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category slug already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res) => {
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
      const existingCategory = await Category.findOne({ 
        slug: req.body.slug,
        _id: { $ne: req.params.id }
      });
      
      if (existingCategory) {
        req.body.slug = `${req.body.slug}-${Date.now()}`;
      }
    }

    // Update level if parent is changed
    if (req.body.parent !== undefined) {
      if (req.body.parent) {
        const parentCategory = await Category.findById(req.body.parent);
        if (!parentCategory) {
          return res.status(400).json({
            success: false,
            message: 'Parent category not found'
          });
        }
        
        // Prevent circular reference
        if (req.body.parent === req.params.id) {
          return res.status(400).json({
            success: false,
            message: 'Category cannot be its own parent'
          });
        }

        req.body.level = parentCategory.level + 1;
      } else {
        req.body.level = 0;
      }
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    ).populate('parent', 'name slug');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    console.error('Error in updateCategory:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category slug already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: req.params.id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} products. Move products to another category first.`
      });
    }

    // Check if category has subcategories
    const subcategoryCount = await Category.countDocuments({ parent: req.params.id });
    if (subcategoryCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${subcategoryCount} subcategories. Delete subcategories first.`
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Toggle category status
// @route   PATCH /api/categories/:id/toggle-status
// @access  Private/Admin
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      category: {
        id: category._id,
        name: category.name,
        isActive: category.isActive
      }
    });
  } catch (error) {
    console.error('Error in toggleCategoryStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get featured categories
// @route   GET /api/categories/featured
// @access  Public
exports.getFeaturedCategories = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const categories = await Category.find({
      isFeatured: true,
      isActive: true
    })
    .limit(parseInt(limit))
    .sort({ sortOrder: 1, name: 1 })
    .lean();

    // Get product count for each category
    for (let category of categories) {
      category.productCount = await Product.countDocuments({
        category: category._id,
        isActive: true
      });
    }

    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error('Error in getFeaturedCategories:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Reorder categories
// @route   PUT /api/categories/reorder
// @access  Private/Admin
exports.reorderCategories = async (req, res) => {
  try {
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: 'Categories must be an array'
      });
    }

    // Update sort order for each category
    const updatePromises = categories.map((cat, index) => 
      Category.findByIdAndUpdate(cat.id, { sortOrder: index + 1 })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Categories reordered successfully'
    });
  } catch (error) {
    console.error('Error in reorderCategories:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};