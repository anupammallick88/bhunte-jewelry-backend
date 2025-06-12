const Coupon = require('../models/Coupon');
const { validationResult } = require('express-validator');

// @desc    Validate coupon code
// @route   POST /api/coupons/validate
// @access  Private/Public
exports.validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount = 0, userId } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    // Check if coupon is valid (not expired, usage limits, etc.)
    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired or reached usage limit'
      });
    }

    // Check minimum order amount
    if (orderAmount < coupon.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount for this coupon is $${coupon.minimumOrderAmount}`,
        minimumAmount: coupon.minimumOrderAmount
      });
    }

    // Check user usage limit
    if (userId && !coupon.canUserUse(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon the maximum number of times'
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (orderAmount * coupon.value) / 100;
      if (coupon.maximumDiscountAmount) {
        discount = Math.min(discount, coupon.maximumDiscountAmount);
      }
    } else if (coupon.type === 'fixed') {
      discount = Math.min(coupon.value, orderAmount);
    }

    res.json({
      success: true,
      message: 'Coupon is valid',
      coupon: {
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        discount: discount,
        minimumOrderAmount: coupon.minimumOrderAmount
      }
    });
  } catch (error) {
    console.error('Error in validateCoupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update coupon (Admin)
// @route   PUT /api/coupons/admin/:id
// @access  Private/Admin
exports.updateCoupon = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Convert code to uppercase if provided
    if (req.body.code) {
      req.body.code = req.body.code.toUpperCase();
      
      // Check if new code conflicts with existing coupons
      const existingCoupon = await Coupon.findOne({ 
        code: req.body.code,
        _id: { $ne: req.params.id }
      });
      
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists'
        });
      }
    }

    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    console.error('Error in updateCoupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete coupon (Admin)
// @route   DELETE /api/coupons/admin/:id
// @access  Private/Admin
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    await Coupon.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteCoupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Toggle coupon status (Admin)
// @route   PATCH /api/coupons/admin/:id/toggle-status
// @access  Private/Admin
exports.toggleCouponStatus = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      coupon: {
        id: coupon._id,
        code: coupon.code,
        isActive: coupon.isActive
      }
    });
  } catch (error) {
    console.error('Error in toggleCouponStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get coupon usage statistics (Admin)
// @route   GET /api/coupons/admin/:id/stats
// @access  Private/Admin
exports.getCouponStats = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Get usage statistics
    const stats = {
      totalUsage: coupon.usageCount,
      usageLimit: coupon.usageLimit,
      usagePercentage: coupon.usageLimit ? (coupon.usageCount / coupon.usageLimit) * 100 : 0,
      uniqueUsers: coupon.usedBy.length,
      isActive: coupon.isActive,
      isValid: coupon.isValid(),
      daysUntilExpiry: Math.ceil((coupon.endDate - new Date()) / (1000 * 60 * 60 * 24))
    };

    res.json({
      success: true,
      coupon: {
        id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        value: coupon.value
      },
      stats
    });
  } catch (error) {
    console.error('Error in getCouponStats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all coupons (Admin)
// @route   GET /api/coupons/admin/all
// @access  Private/Admin
exports.getAllCoupons = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status,
      type,
      search 
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    if (status) {
      if (status === 'active') {
        query.isActive = true;
        query.endDate = { $gt: new Date() };
      } else if (status === 'expired') {
        query.endDate = { $lt: new Date() };
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }
    
    if (type) {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Coupon.countDocuments(query);

    res.json({
      success: true,
      coupons,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllCoupons:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create coupon (Admin)
// @route   POST /api/coupons/admin/create
// @access  Private/Admin
exports.createCoupon = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Convert code to uppercase
    if (req.body.code) {
      req.body.code = req.body.code.toUpperCase();
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: req.body.code });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    const coupon = new Coupon(req.body);
    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    console.error('Error in createCoupon:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};