const CustomerStory = require('../models/CustomerStory');
const { validationResult } = require('express-validator');

exports.getAllStories = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      occasionType,
      featured,
      status = 'published'
    } = req.query;

    const query = { status, isPublished: true };

    if (occasionType && occasionType !== 'all') {
      query.occasionType = occasionType;
    }

    if (featured === 'true') {
      query.isFeatured = true;
    }

    const stories = await CustomerStory.find(query)
      .populate('productsPurchased.product', 'name slug images price')
      .sort({ publishedDate: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await CustomerStory.countDocuments(query);

    res.json({
      success: true,
      stories,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalStories: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getStoryBySlug = async (req, res) => {
  try {
    const story = await CustomerStory.findOne({ 
      slug: req.params.slug, 
      status: 'published',
      isPublished: true 
    }).populate('productsPurchased.product', 'name slug images price');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      });
    }

    // Increment view count
    story.viewCount += 1;
    await story.save();

    res.json({
      success: true,
      story
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.submitStory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const story = new CustomerStory({
      ...req.body,
      status: 'pending'
    });

    await story.save();

    res.status(201).json({
      success: true,
      message: 'Story submitted successfully. It will be reviewed before publishing.',
      story
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.likeStory = async (req, res) => {
  try {
    const story = await CustomerStory.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      });
    }

    const userId = req.user.id;
    const hasLiked = story.likedBy.includes(userId);

    if (hasLiked) {
      story.likedBy.pull(userId);
      story.likes -= 1;
    } else {
      story.likedBy.push(userId);
      story.likes += 1;
    }

    await story.save();

    res.json({
      success: true,
      message: hasLiked ? 'Story unliked' : 'Story liked',
      likes: story.likes,
      isLiked: !hasLiked
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};