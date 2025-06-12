const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');

// @desc    Create product review
// @route   POST /api/reviews
// @access  Private
exports.createReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { productId, rating, title, comment, images, orderId } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      product: productId,
      user: req.user.id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    // Verify user has purchased this product (if orderId provided)
    let verified = false;
    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        customer: req.user.id,
        status: { $in: ['delivered', 'completed'] },
        'items.product': productId
      });
      verified = !!order;
    }

    // Create review
    const review = new Review({
      product: productId,
      user: req.user.id,
      order: orderId,
      rating,
      title,
      comment,
      images: images || [],
      verified,
      status: 'pending' // Reviews need admin approval
    });

    await review.save();

    // Create notification for admin
    await Notification.create({
      type: 'review_submitted',
      title: 'New Review Submitted',
      message: `A new review has been submitted for ${product.name}`,
      recipientType: 'all_admins',
      actionUrl: `/admin/reviews/${review._id}`,
      data: {
        reviewId: review._id,
        productId: productId,
        productName: product.name,
        rating: rating
      }
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully and is pending approval',
      review: {
        id: review._id,
        rating: review.rating,
        title: review.title,
        status: review.status
      }
    });
  } catch (error) {
    console.error('Error in createReview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get product reviews
// @route   GET /api/reviews/product/:productId
// @access  Public
exports.getProductReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt', rating } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      product: req.params.productId,
      status: 'approved'
    };

    if (rating) {
      query.rating = parseInt(rating);
    }

    const reviews = await Review.find(query)
      .populate('user', 'firstName lastName')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Review.countDocuments(query);

    // Get review statistics
    const reviewStats = await Review.aggregate([
      { 
        $match: { 
          product: mongoose.Types.ObjectId(req.params.productId), 
          status: 'approved' 
        } 
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]);

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviewStats.forEach(stat => {
      ratingDistribution[stat._id] = stat.count;
    });

    // Calculate average rating
    const avgStats = await Review.aggregate([
      { 
        $match: { 
          product: mongoose.Types.ObjectId(req.params.productId), 
          status: 'approved' 
        } 
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      reviews,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit)
      },
      statistics: {
        averageRating: avgStats[0]?.averageRating || 0,
        totalReviews: avgStats[0]?.totalReviews || 0,
        ratingDistribution
      }
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

// @desc    Get user's reviews
// @route   GET /api/reviews/my-reviews
// @access  Private
exports.getUserReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ user: req.user.id })
      .populate('product', 'name images slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Review.countDocuments({ user: req.user.id });

    res.json({
      success: true,
      reviews,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getUserReviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Mark review as helpful
// @route   POST /api/reviews/:id/helpful
// @access  Private
exports.markReviewHelpful = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user already marked this review as helpful
    if (review.helpfulBy.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You have already marked this review as helpful'
      });
    }

    review.helpfulBy.push(req.user.id);
    review.helpfulCount += 1;
    await review.save();

    res.json({
      success: true,
      message: 'Review marked as helpful',
      helpfulCount: review.helpfulCount
    });
  } catch (error) {
    console.error('Error in markReviewHelpful:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all reviews (Admin)
// @route   GET /api/reviews/admin/all
// @access  Private/Admin
exports.getAllReviews = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      rating,
      search 
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (rating) {
      query.rating = parseInt(rating);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { comment: { $regex: search, $options: 'i' } }
      ];
    }

    const reviews = await Review.find(query)
      .populate('user', 'firstName lastName email')
      .populate('product', 'name images slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Review.countDocuments(query);

    // Get review statistics
    const stats = await Review.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      reviews,
      total,
      stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllReviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update review status (Admin)
// @route   PATCH /api/reviews/admin/:id/status
// @access  Private/Admin
exports.updateReviewStatus = async (req, res) => {
  try {
    const { status, adminReply } = req.body;
    
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const review = await Review.findById(req.params.id)
      .populate('product', 'name')
      .populate('user', 'firstName lastName email');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const oldStatus = review.status;
    review.status = status;

    if (adminReply) {
      review.adminReply = {
        message: adminReply,
        repliedAt: new Date(),
        repliedBy: req.user.id
      };
    }

    await review.save();

    // Update product rating if review is approved
    if (status === 'approved' && oldStatus !== 'approved') {
      await updateProductRating(review.product._id);
    } else if (oldStatus === 'approved' && status !== 'approved') {
      await updateProductRating(review.product._id);
    }

    // Send notification to customer
    if (status === 'approved') {
      await Notification.create({
        type: 'review_approved',
        title: 'Review Approved',
        message: `Your review for ${review.product.name} has been approved`,
        recipient: review.user._id,
        recipientType: 'customer',
        actionUrl: `/products/${review.product.slug}#reviews`
      });
    }

    res.json({
      success: true,
      message: `Review ${status} successfully`,
      review: {
        id: review._id,
        status: review.status
      }
    });
  } catch (error) {
    console.error('Error in updateReviewStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Helper function to update product rating
const updateProductRating = async (productId) => {
  try {
    const stats = await Review.aggregate([
      { 
        $match: { 
          product: mongoose.Types.ObjectId(productId), 
          status: 'approved' 
        } 
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    const { averageRating = 0, reviewCount = 0 } = stats[0] || {};

    await Product.findByIdAndUpdate(productId, {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      reviewCount
    });
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};