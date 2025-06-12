const BlogPost = require('../models/BlogPost');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const slugify = require('slugify');

// @desc    Get all blog posts
// @route   GET /api/blog
// @access  Public
exports.getAllBlogPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      tags,
      search,
      author,
      status = 'published'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    const query = { status };

    if (category) {
      query.category = category;
    }

    if (tags) {
      const tagArray = tags.split(',');
      query.tags = { $in: tagArray };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    if (author) {
      query.author = author;
    }

    const posts = await BlogPost.find(query)
      .populate('author', 'firstName lastName')
      .sort({ publishedDate: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await BlogPost.countDocuments(query);

    res.json({
      success: true,
      posts,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllBlogPosts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get blog post by slug
// @route   GET /api/blog/:slug
// @access  Public
exports.getBlogPostBySlug = async (req, res) => {
  try {
    const post = await BlogPost.findOne({ 
      slug: req.params.slug, 
      status: 'published' 
    })
    .populate('author', 'firstName lastName')
    .populate('relatedPosts', 'title slug excerpt featuredImage publishedDate');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    // Increment view count
    post.viewCount += 1;
    await post.save();

    // Get related posts if not specified
    if (!post.relatedPosts || post.relatedPosts.length === 0) {
      const relatedPosts = await BlogPost.find({
        _id: { $ne: post._id },
        category: post.category,
        status: 'published'
      })
      .limit(3)
      .select('title slug excerpt featuredImage publishedDate')
      .sort({ publishedDate: -1 })
      .lean();

      post.relatedPosts = relatedPosts;
    }

    res.json({
      success: true,
      post
    });
  } catch (error) {
    console.error('Error in getBlogPostBySlug:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get blog categories
// @route   GET /api/blog/categories
// @access  Public
exports.getBlogCategories = async (req, res) => {
  try {
    const categories = await BlogPost.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      categories: categories.map(cat => ({
        name: cat._id,
        count: cat.count
      }))
    });
  } catch (error) {
    console.error('Error in getBlogCategories:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get popular tags
// @route   GET /api/blog/tags
// @access  Public
exports.getPopularTags = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const tags = await BlogPost.aggregate([
      { $match: { status: 'published' } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      tags: tags.map(tag => ({
        name: tag._id,
        count: tag.count
      }))
    });
  } catch (error) {
    console.error('Error in getPopularTags:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create blog post (Admin)
// @route   POST /api/blog/admin/create
// @access  Private/Admin
exports.createBlogPost = async (req, res) => {
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
      req.body.slug = slugify(req.body.title, { lower: true });
    }

    // Check if slug already exists
    const existingPost = await BlogPost.findOne({ slug: req.body.slug });
    if (existingPost) {
      req.body.slug = `${req.body.slug}-${Date.now()}`;
    }

    // Set author to current user
    req.body.author = req.user.id;

    // Set published date if status is published
    if (req.body.status === 'published' && !req.body.publishedDate) {
      req.body.publishedDate = new Date();
    }

    const post = new BlogPost(req.body);
    await post.save();

    // Populate the saved post
    await post.populate('author', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      post
    });
  } catch (error) {
    console.error('Error in createBlogPost:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update blog post (Admin)
// @route   PUT /api/blog/admin/:id
// @access  Private/Admin
exports.updateBlogPost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // If title is being updated, regenerate slug
    if (req.body.title && !req.body.slug) {
      req.body.slug = slugify(req.body.title, { lower: true });
      
      // Check if new slug conflicts
      const existingPost = await BlogPost.findOne({ 
        slug: req.body.slug,
        _id: { $ne: req.params.id }
      });
      
      if (existingPost) {
        req.body.slug = `${req.body.slug}-${Date.now()}`;
      }
    }

    // Set published date if status changes to published
    const currentPost = await BlogPost.findById(req.params.id);
    if (req.body.status === 'published' && currentPost.status !== 'published' && !req.body.publishedDate) {
      req.body.publishedDate = new Date();
    }

    const post = await BlogPost.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    ).populate('author', 'firstName lastName');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    res.json({
      success: true,
      message: 'Blog post updated successfully',
      post
    });
  } catch (error) {
    console.error('Error in updateBlogPost:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete blog post (Admin)
// @route   DELETE /api/blog/admin/:id
// @access  Private/Admin
exports.deleteBlogPost = async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    res.json({
      success: true,
      message: 'Blog post deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteBlogPost:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all blog posts (Admin)
// @route   GET /api/blog/admin/all
// @access  Private/Admin
exports.getAllBlogPostsAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      author,
      search
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (author) {
      query.author = author;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } }
      ];
    }

    const posts = await BlogPost.find(query)
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await BlogPost.countDocuments(query);

    // Get post statistics
    const stats = await BlogPost.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      posts,
      total,
      stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllBlogPostsAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get blog post by ID (Admin)
// @route   GET /api/blog/admin/:id
// @access  Private/Admin
exports.getBlogPostByIdAdmin = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id)
      .populate('author', 'firstName lastName')
      .populate('relatedPosts', 'title slug');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    res.json({
      success: true,
      post
    });
  } catch (error) {
    console.error('Error in getBlogPostByIdAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};