const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { validationResult } = require('express-validator');

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
exports.getCart = async (req, res) => {
  try {
    let cart;
    
    if (req.user) {
      cart = await Cart.findOne({ user: req.user.id, isActive: true })
        .populate('items.product', 'name images price inventory attributes isActive');
    } else {
      // For guest users
      const sessionId = req.headers['session-id'];
      if (sessionId) {
        cart = await Cart.findOne({ sessionId, isActive: true })
          .populate('items.product', 'name images price inventory attributes isActive');
      }
    }

    if (!cart) {
      return res.json({
        success: true,
        cart: {
          items: [],
          subtotal: 0,
          tax: 0,
          shipping: 0,
          total: 0,
          itemCount: 0
        }
      });
    }

    // Remove items for inactive products
    cart.items = cart.items.filter(item => item.product && item.product.isActive);

    // Recalculate totals
    cart.calculateTotals();
    await cart.save();

    const cartData = {
      id: cart._id,
      items: cart.items.map(item => ({
        id: item._id,
        product: item.product,
        variant: item.variant,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.price * item.quantity,
        addedAt: item.addedAt
      })),
      subtotal: cart.subtotal,
      tax: cart.tax,
      shipping: cart.shipping,
      total: cart.total,
      couponCode: cart.couponCode,
      discount: cart.discount,
      itemCount: cart.items.length
    };

    res.json({
      success: true,
      cart: cartData
    });
  } catch (error) {
    console.error('Error in getCart:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private/Public (with session)
exports.addToCart = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { productId, quantity = 1, variant = {} } = req.body;

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

    // Check inventory
    if (product.inventory.trackQuantity && product.inventory.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.inventory.quantity} items available in stock`
      });
    }

    let cart;
    const cartQuery = req.user 
      ? { user: req.user.id, isActive: true }
      : { sessionId: req.headers['session-id'], isActive: true };

    cart = await Cart.findOne(cartQuery);

    if (!cart) {
      // Create new cart
      const cartData = {
        items: [{
          product: productId,
          variant,
          quantity,
          price: product.price
        }],
        isActive: true
      };

      if (req.user) {
        cartData.user = req.user.id;
      } else {
        cartData.sessionId = req.headers['session-id'] || `guest_${Date.now()}`;
      }

      cart = new Cart(cartData);
    } else {
      // Check if product with same variant already exists in cart
      const existingItemIndex = cart.items.findIndex(item => 
        item.product.toString() === productId &&
        JSON.stringify(item.variant) === JSON.stringify(variant)
      );

      if (existingItemIndex > -1) {
        // Update quantity
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        
        // Check inventory for new quantity
        if (product.inventory.trackQuantity && product.inventory.quantity < newQuantity) {
          return res.status(400).json({
            success: false,
            message: `Only ${product.inventory.quantity} items available in stock`
          });
        }

        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].price = product.price; // Update price in case it changed
      } else {
        // Add new item
        cart.items.push({
          product: productId,
          variant,
          quantity,
          price: product.price
        });
      }
    }

    // Calculate totals
    cart.calculateTotals();
    await cart.save();

    // Populate cart for response
    await cart.populate('items.product', 'name images price inventory attributes');

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      cart: {
        items: cart.items,
        subtotal: cart.subtotal,
        total: cart.total,
        itemCount: cart.items.length
      }
    });
  } catch (error) {
    console.error('Error in addToCart:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
// @access  Private/Public (with session)
exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const { itemId } = req.params;

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const cartQuery = req.user 
      ? { user: req.user.id, isActive: true }
      : { sessionId: req.headers['session-id'], isActive: true };

    const cart = await Cart.findOne(cartQuery)
      .populate('items.product', 'name images price inventory attributes');

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    // Check inventory
    if (item.product.inventory.trackQuantity && item.product.inventory.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${item.product.inventory.quantity} items available in stock`
      });
    }

    item.quantity = quantity;
    
    // Calculate totals
    cart.calculateTotals();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      cart: {
        items: cart.items,
        subtotal: cart.subtotal,
        total: cart.total,
        itemCount: cart.items.length
      }
    });
  } catch (error) {
    console.error('Error in updateCartItem:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
// @access  Private/Public (with session)
exports.removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const cartQuery = req.user 
      ? { user: req.user.id, isActive: true }
      : { sessionId: req.headers['session-id'], isActive: true };

    const cart = await Cart.findOne(cartQuery)
      .populate('items.product', 'name images price inventory attributes');

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    cart.items.pull(itemId);
    
    // Calculate totals
    cart.calculateTotals();
    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      cart: {
        items: cart.items,
        subtotal: cart.subtotal,
        total: cart.total,
        itemCount: cart.items.length
      }
    });
  } catch (error) {
    console.error('Error in removeCartItem:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart/clear
// @access  Private/Public (with session)
exports.clearCart = async (req, res) => {
  try {
    const cartQuery = req.user 
      ? { user: req.user.id, isActive: true }
      : { sessionId: req.headers['session-id'], isActive: true };

    const cart = await Cart.findOne(cartQuery);

    if (!cart) {
      return res.json({
        success: true,
        message: 'Cart is already empty'
      });
    }

    cart.items = [];
    cart.subtotal = 0;
    cart.tax = 0;
    cart.shipping = 0;
    cart.total = 0;
    cart.couponCode = undefined;
    cart.discount = 0;

    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      cart: {
        items: [],
        subtotal: 0,
        total: 0,
        itemCount: 0
      }
    });
  } catch (error) {
    console.error('Error in clearCart:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Apply coupon to cart
// @route   POST /api/cart/apply-coupon
// @access  Private/Public (with session)
exports.applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    const cartQuery = req.user 
      ? { user: req.user.id, isActive: true }
      : { sessionId: req.headers['session-id'], isActive: true };

    const cart = await Cart.findOne(cartQuery)
      .populate('items.product', 'name price category');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isActive: true 
    });

    if (!coupon || !coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired coupon code'
      });
    }

    // Check if user can use this coupon
    if (req.user && !coupon.canUserUse(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon'
      });
    }

    // Check minimum order amount
    if (cart.subtotal < coupon.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount for this coupon is $${coupon.minimumOrderAmount}`
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (cart.subtotal * coupon.value) / 100;
      if (coupon.maximumDiscountAmount) {
        discount = Math.min(discount, coupon.maximumDiscountAmount);
      }
    } else if (coupon.type === 'fixed') {
      discount = Math.min(coupon.value, cart.subtotal);
    } else if (coupon.type === 'free_shipping') {
      // This will be handled in shipping calculation
      discount = 0;
    }

    cart.couponCode = coupon.code;
    cart.discount = discount;
    
    // Recalculate totals with coupon
    cart.calculateTotals();
    await cart.save();

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      cart: {
        items: cart.items,
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total,
        couponCode: cart.couponCode
      },
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount: discount
      }
    });
  } catch (error) {
    console.error('Error in applyCoupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Remove coupon from cart
// @route   DELETE /api/cart/remove-coupon
// @access  Private/Public (with session)
exports.removeCoupon = async (req, res) => {
  try {
    const cartQuery = req.user 
      ? { user: req.user.id, isActive: true }
      : { sessionId: req.headers['session-id'], isActive: true };

    const cart = await Cart.findOne(cartQuery)
      .populate('items.product', 'name images price');

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.couponCode = undefined;
    cart.discount = 0;
    
    // Recalculate totals without coupon
    cart.calculateTotals();
    await cart.save();

    res.json({
      success: true,
      message: 'Coupon removed successfully',
      cart: {
        items: cart.items,
        subtotal: cart.subtotal,
        discount: 0,
        total: cart.total,
        couponCode: null
      }
    });
  } catch (error) {
    console.error('Error in removeCoupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Merge guest cart with user cart (on login)
// @route   POST /api/cart/merge
// @access  Private
exports.mergeCart = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.json({
        success: true,
        message: 'No guest cart to merge'
      });
    }

    // Find guest cart
    const guestCart = await Cart.findOne({ 
      sessionId, 
      isActive: true 
    }).populate('items.product');

    if (!guestCart || guestCart.items.length === 0) {
      return res.json({
        success: true,
        message: 'No guest cart to merge'
      });
    }

    // Find or create user cart
    let userCart = await Cart.findOne({ 
      user: req.user.id, 
      isActive: true 
    }).populate('items.product');

    if (!userCart) {
      // Create new user cart from guest cart
      userCart = new Cart({
        user: req.user.id,
        items: guestCart.items,
        isActive: true
      });
    } else {
      // Merge guest cart items into user cart
      for (const guestItem of guestCart.items) {
        const existingItemIndex = userCart.items.findIndex(item => 
          item.product._id.toString() === guestItem.product._id.toString() &&
          JSON.stringify(item.variant) === JSON.stringify(guestItem.variant)
        );

        if (existingItemIndex > -1) {
          // Update quantity
          userCart.items[existingItemIndex].quantity += guestItem.quantity;
        } else {
          // Add new item
          userCart.items.push(guestItem);
        }
      }
    }

    // Calculate totals and save
    userCart.calculateTotals();
    await userCart.save();

    // Deactivate guest cart
    guestCart.isActive = false;
    await guestCart.save();

    res.json({
      success: true,
      message: 'Carts merged successfully',
      cart: {
        items: userCart.items,
        subtotal: userCart.subtotal,
        total: userCart.total,
        itemCount: userCart.items.length
      }
    });
  } catch (error) {
    console.error('Error in mergeCart:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};