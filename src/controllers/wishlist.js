const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const { validationResult } = require('express-validator');

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
exports.getWishlist = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.id })
      .populate('products.product', 'name images price inventory averageRating reviewCount isActive');

    if (!wishlist) {
      wishlist = {
        products: [],
        isPublic: false,
        name: 'My Wishlist'
      };
    } else {
      // Filter out inactive products
      wishlist.products = wishlist.products.filter(item => 
        item.product && item.product.isActive
      );
    }

    res.json({
      success: true,
      wishlist: {
        id: wishlist._id,
        name: wishlist.name,
        isPublic: wishlist.isPublic,
        products: wishlist.products.map(item => ({
          id: item._id,
          product: item.product,
          variant: item.variant,
          notes: item.notes,
          addedAt: item.addedAt
        })),
        itemCount: wishlist.products.length
      }
    });
  } catch (error) {
    console.error('Error in getWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add product to wishlist
// @route   POST /api/wishlist/add
// @access  Private
exports.addToWishlist = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { productId, variant = {}, notes = '' } = req.body;

    // Validate product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available'
      });
    }

    let wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      // Create new wishlist
      wishlist = new Wishlist({
        user: req.user.id,
        products: [{
          product: productId,
          variant,
          notes
        }]
      });
    } else {
      // Check if product already exists in wishlist
      const existingProductIndex = wishlist.products.findIndex(item => 
        item.product.toString() === productId &&
        JSON.stringify(item.variant) === JSON.stringify(variant)
      );

      if (existingProductIndex > -1) {
        return res.status(400).json({
          success: false,
          message: 'Product already in wishlist'
        });
      }

      // Add new product to wishlist
      wishlist.products.push({
        product: productId,
        variant,
        notes
      });
    }

    await wishlist.save();

    // Populate the added product
    await wishlist.populate('products.product', 'name images price');

    res.json({
      success: true,
      message: 'Product added to wishlist successfully',
      wishlist: {
        products: wishlist.products,
        itemCount: wishlist.products.length
      }
    });
  } catch (error) {
    console.error('Error in addToWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/remove/:productId
// @access  Private
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variant } = req.body;

    const wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Find and remove the product
    const productIndex = wishlist.products.findIndex(item => {
      const productMatch = item.product.toString() === productId;
      const variantMatch = variant ? 
        JSON.stringify(item.variant) === JSON.stringify(variant) : 
        true;
      return productMatch && variantMatch;
    });

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in wishlist'
      });
    }

    wishlist.products.splice(productIndex, 1);
    await wishlist.save();

    res.json({
      success: true,
      message: 'Product removed from wishlist successfully',
      wishlist: {
        products: wishlist.products,
        itemCount: wishlist.products.length
      }
    });
  } catch (error) {
    console.error('Error in removeFromWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update wishlist item notes
// @route   PUT /api/wishlist/items/:itemId
// @access  Private
exports.updateWishlistItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { notes } = req.body;

    const wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    const item = wishlist.products.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found'
      });
    }

    item.notes = notes;
    await wishlist.save();

    res.json({
      success: true,
      message: 'Wishlist item updated successfully',
      item: {
        id: item._id,
        notes: item.notes
      }
    });
  } catch (error) {
    console.error('Error in updateWishlistItem:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Clear wishlist
// @route   DELETE /api/wishlist/clear
// @access  Private
exports.clearWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      return res.json({
        success: true,
        message: 'Wishlist is already empty'
      });
    }

    wishlist.products = [];
    await wishlist.save();

    res.json({
      success: true,
      message: 'Wishlist cleared successfully',
      wishlist: {
        products: [],
        itemCount: 0
      }
    });
  } catch (error) {
    console.error('Error in clearWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update wishlist settings
// @route   PUT /api/wishlist/settings
// @access  Private
exports.updateWishlistSettings = async (req, res) => {
  try {
    const { name, isPublic } = req.body;

    let wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: req.user.id,
        name: name || 'My Wishlist',
        isPublic: isPublic || false
      });
    } else {
      if (name !== undefined) wishlist.name = name;
      if (isPublic !== undefined) wishlist.isPublic = isPublic;
    }

    await wishlist.save();

    res.json({
      success: true,
      message: 'Wishlist settings updated successfully',
      wishlist: {
        name: wishlist.name,
        isPublic: wishlist.isPublic
      }
    });
  } catch (error) {
    console.error('Error in updateWishlistSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Check if product is in wishlist
// @route   GET /api/wishlist/check/:productId
// @access  Private
exports.checkProductInWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variant } = req.query;

    const wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      return res.json({
        success: true,
        inWishlist: false
      });
    }

    const isInWishlist = wishlist.products.some(item => {
      const productMatch = item.product.toString() === productId;
      const variantMatch = variant ? 
        JSON.stringify(item.variant) === JSON.stringify(JSON.parse(variant)) : 
        true;
      return productMatch && variantMatch;
    });

    res.json({
      success: true,
      inWishlist: isInWishlist
    });
  } catch (error) {
    console.error('Error in checkProductInWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Share wishlist (get public wishlist)
// @route   GET /api/wishlist/public/:userId
// @access  Public
exports.getPublicWishlist = async (req, res) => {
  try {
    const { userId } = req.params;

    const wishlist = await Wishlist.findOne({ 
      user: userId, 
      isPublic: true 
    })
    .populate('products.product', 'name images price averageRating reviewCount')
    .populate('user', 'firstName lastName');

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Public wishlist not found'
      });
    }

    // Filter out inactive products
    wishlist.products = wishlist.products.filter(item => 
      item.product && item.product.isActive
    );

    res.json({
      success: true,
      wishlist: {
        name: wishlist.name,
        owner: wishlist.user,
        products: wishlist.products.map(item => ({
          product: item.product,
          variant: item.variant,
          addedAt: item.addedAt
        })),
        itemCount: wishlist.products.length
      }
    });
  } catch (error) {
    console.error('Error in getPublicWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};