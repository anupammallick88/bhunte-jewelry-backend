const Content = require('../models/Content');
const { validationResult } = require('express-validator');
const slugify = require('slugify');

// @desc    Get content by type and position
// @route   GET /api/content
// @access  Public
exports.getContent = async (req, res) => {
  try {
    const { type, position, active = true } = req.query;

    // Build query
    const query = {};
    
    if (type) {
      query.type = type;
    }
    
    if (position) {
      query.position = position;
    }
    
    if (active === 'true') {
      query.isActive = true;
      
      // Check date range if specified
      const now = new Date();
      query.$or = [
        {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      content,
      total,
      stats: {
        byType: stats,
        byStatus: statusStats
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllContentAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get content by ID (Admin)
// @route   GET /api/content/admin/:id
// @access  Private/Admin
exports.getContentByIdAdmin = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      content
    });
  } catch (error) {
    console.error('Error in getContentByIdAdmin:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Reorder content (Admin)
// @route   PUT /api/content/admin/reorder
// @access  Private/Admin
exports.reorderContent = async (req, res) => {
  try {
    const { content } = req.body;

    if (!Array.isArray(content)) {
      return res.status(400).json({
        success: false,
        message: 'Content array is required'
      });
    }

    // Update display order for each content item
    const updatePromises = content.map((item, index) => 
      Content.findByIdAndUpdate(item.id, { displayOrder: index + 1 })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Content reordered successfully'
    });
  } catch (error) {
    console.error('Error in reorderContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Duplicate content (Admin)
// @route   POST /api/content/admin/:id/duplicate
// @access  Private/Admin
exports.duplicateContent = async (req, res) => {
  try {
    const originalContent = await Content.findById(req.params.id);

    if (!originalContent) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    // Create duplicate with modified name and slug
    const duplicateData = originalContent.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;

    duplicateData.name = `${duplicateData.name} (Copy)`;
    duplicateData.slug = `${duplicateData.slug}-copy-${Date.now()}`;
    duplicateData.isActive = false; // Make duplicate inactive by default

    const duplicateContent = new Content(duplicateData);
    await duplicateContent.save();

    res.status(201).json({
      success: true,
      message: 'Content duplicated successfully',
      content: duplicateContent
    });
  } catch (error) {
    console.error('Error in duplicateContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get content by type (Admin)
// @route   GET /api/content/admin/type/:type
// @access  Private/Admin
exports.getContentByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { position, active } = req.query;

    const query = { type };
    
    if (position) {
      query.position = position;
    }
    
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    const content = await Content.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: content.length,
      content
    });
  } catch (error) {
    console.error('Error in getContentByType:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Schedule content (Admin)
// @route   PATCH /api/content/admin/:id/schedule
// @access  Private/Admin
exports.scheduleContent = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required'
      });
    }

    const content = await Content.findById(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    content.startDate = new Date(startDate);
    if (endDate) {
      content.endDate = new Date(endDate);
    }

    await content.save();

    res.json({
      success: true,
      message: 'Content scheduled successfully',
      content: {
        id: content._id,
        name: content.name,
        startDate: content.startDate,
        endDate: content.endDate
      }
    });
  } catch (error) {
    console.error('Error in scheduleContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get content templates (Admin)
// @route   GET /api/content/admin/templates
// @access  Private/Admin
exports.getContentTemplates = async (req, res) => {
  try {
    const { type } = req.query;

    // Define content templates based on type
    const templates = {
      hero: [
        {
          name: 'Full Width Hero',
          description: 'Full width hero banner with background image',
          structure: {
            title: 'string',
            subtitle: 'string',
            backgroundImage: 'string',
            ctaText: 'string',
            ctaLink: 'string',
            overlay: 'boolean'
          },
          defaultContent: {
            title: 'Welcome to Angara Jewelry',
            subtitle: 'Discover our exquisite collection of handcrafted jewelry',
            backgroundImage: '/images/hero-bg.jpg',
            ctaText: 'Shop Now',
            ctaLink: '/products',
            overlay: true
          }
        },
        {
          name: 'Split Hero',
          description: 'Split layout with image and text',
          structure: {
            title: 'string',
            description: 'string',
            image: 'string',
            ctaText: 'string',
            ctaLink: 'string',
            imagePosition: 'string'
          },
          defaultContent: {
            title: 'Elegant Jewelry for Every Occasion',
            description: 'From engagement rings to everyday elegance, find the perfect piece to express your unique style.',
            image: '/images/hero-split.jpg',
            ctaText: 'Explore Collection',
            ctaLink: '/collections',
            imagePosition: 'right'
          }
        },
        {
          name: 'Video Hero',
          description: 'Hero section with background video',
          structure: {
            title: 'string',
            subtitle: 'string',
            videoUrl: 'string',
            posterImage: 'string',
            ctaText: 'string',
            ctaLink: 'string',
            autoplay: 'boolean',
            muted: 'boolean'
          },
          defaultContent: {
            title: 'Crafted with Passion',
            subtitle: 'Watch our artisans create timeless pieces',
            videoUrl: '/videos/crafting-process.mp4',
            posterImage: '/images/video-poster.jpg',
            ctaText: 'View Process',
            ctaLink: '/about/craftsmanship',
            autoplay: true,
            muted: true
          }
        }
      ],
      banner: [
        {
          name: 'Promotional Banner',
          description: 'Banner for promotions and announcements',
          structure: {
            message: 'string',
            backgroundColor: 'string',
            textColor: 'string',
            link: 'string',
            ctaText: 'string',
            dismissible: 'boolean',
            icon: 'string'
          },
          defaultContent: {
            message: 'Free shipping on orders over $100',
            backgroundColor: '#185181',
            textColor: '#ffffff',
            link: '/shipping-info',
            ctaText: 'Learn More',
            dismissible: true,
            icon: 'truck'
          }
        },
        {
          name: 'Image Banner',
          description: 'Banner with background image',
          structure: {
            title: 'string',
            message: 'string',
            backgroundImage: 'string',
            ctaText: 'string',
            ctaLink: 'string',
            textAlign: 'string',
            overlay: 'boolean'
          },
          defaultContent: {
            title: 'New Collection Available',
            message: 'Discover our latest designs inspired by nature',
            backgroundImage: '/images/collection-banner.jpg',
            ctaText: 'Shop Collection',
            ctaLink: '/collections/new',
            textAlign: 'center',
            overlay: true
          }
        },
        {
          name: 'Sale Banner',
          description: 'Special sale or discount banner',
          structure: {
            title: 'string',
            discount: 'string',
            description: 'string',
            validUntil: 'date',
            ctaText: 'string',
            ctaLink: 'string',
            urgent: 'boolean'
          },
          defaultContent: {
            title: 'Limited Time Offer',
            discount: '25% OFF',
            description: 'Selected engagement rings',
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            ctaText: 'Shop Sale',
            ctaLink: '/sale',
            urgent: true
          }
        }
      ],
      block: [
        {
          name: 'Text Block',
          description: 'Simple text content block',
          structure: {
            title: 'string',
            content: 'html',
            alignment: 'string',
            backgroundColor: 'string',
            padding: 'string'
          },
          defaultContent: {
            title: 'About Our Craftsmanship',
            content: '<p>Each piece is carefully handcrafted by our skilled artisans using traditional techniques passed down through generations.</p>',
            alignment: 'center',
            backgroundColor: 'transparent',
            padding: 'large'
          }
        },
        {
          name: 'Feature Block',
          description: 'Feature showcase block',
          structure: {
            title: 'string',
            description: 'string',
            features: 'array',
            layout: 'string',
            showIcons: 'boolean'
          },
          defaultContent: {
            title: 'Why Choose Angara',
            description: 'Discover what makes our jewelry special',
            features: [
              {
                title: 'Quality Materials',
                description: 'Premium metals and genuine gemstones',
                icon: 'gem'
              },
              {
                title: 'Expert Craftsmanship',
                description: 'Handcrafted by skilled artisans',
                icon: 'tools'
              },
              {
                title: 'Lifetime Warranty',
                description: 'Complete protection for your investment',
                icon: 'shield'
              }
            ],
            layout: 'grid',
            showIcons: true
          }
        },
        {
          name: 'Testimonial Block',
          description: 'Customer testimonials section',
          structure: {
            title: 'string',
            testimonials: 'array',
            layout: 'string',
            showImages: 'boolean'
          },
          defaultContent: {
            title: 'What Our Customers Say',
            testimonials: [
              {
                quote: 'The quality exceeded my expectations. Beautiful craftsmanship!',
                author: 'Sarah Johnson',
                location: 'New York, NY',
                image: '/images/testimonial-1.jpg',
                rating: 5
              }
            ],
            layout: 'carousel',
            showImages: true
          }
        }
      ],
      page: [
        {
          name: 'Standard Page',
          description: 'Standard page layout',
          structure: {
            title: 'string',
            content: 'html',
            sidebar: 'boolean',
            breadcrumbs: 'boolean',
            toc: 'boolean'
          },
          defaultContent: {
            title: 'About Us',
            content: '<h2>Our Story</h2><p>Founded in 2005, Angara has been creating exceptional jewelry...</p>',
            sidebar: false,
            breadcrumbs: true,
            toc: false
          }
        },
        {
          name: 'FAQ Page',
          description: 'Frequently asked questions page',
          structure: {
            title: 'string',
            introduction: 'string',
            categories: 'array',
            searchable: 'boolean'
          },
          defaultContent: {
            title: 'Frequently Asked Questions',
            introduction: 'Find answers to common questions about our products and services.',
            categories: [
              {
                name: 'Shipping & Returns',
                questions: [
                  {
                    question: 'How long does shipping take?',
                    answer: 'Standard shipping takes 3-5 business days.'
                  }
                ]
              }
            ],
            searchable: true
          }
        }
      ],
      announcement: [
        {
          name: 'Site Announcement',
          description: 'Site-wide announcement',
          structure: {
            message: 'string',
            type: 'string', // info, warning, success, error
            showIcon: 'boolean',
            dismissible: 'boolean',
            link: 'string',
            linkText: 'string'
          },
          defaultContent: {
            message: 'New spring collection now available!',
            type: 'info',
            showIcon: true,
            dismissible: true,
            link: '/collections/spring',
            linkText: 'View Collection'
          }
        },
        {
          name: 'Maintenance Notice',
          description: 'System maintenance announcement',
          structure: {
            title: 'string',
            message: 'string',
            startTime: 'datetime',
            endTime: 'datetime',
            type: 'string',
            affectedServices: 'array'
          },
          defaultContent: {
            title: 'Scheduled Maintenance',
            message: 'Our website will be undergoing maintenance.',
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            type: 'warning',
            affectedServices: ['checkout', 'user accounts']
          }
        }
      ],
      menu: [
        {
          name: 'Main Navigation',
          description: 'Primary website navigation menu',
          structure: {
            items: 'array',
            layout: 'string',
            showIcons: 'boolean',
            mobileCollapsible: 'boolean'
          },
          defaultContent: {
            items: [
              {
                label: 'Home',
                url: '/',
                icon: 'home',
                children: []
              },
              {
                label: 'Jewelry',
                url: '/jewelry',
                icon: 'gem',
                children: [
                  { label: 'Rings', url: '/jewelry/rings' },
                  { label: 'Necklaces', url: '/jewelry/necklaces' },
                  { label: 'Earrings', url: '/jewelry/earrings' }
                ]
              }
            ],
            layout: 'horizontal',
            showIcons: false,
            mobileCollapsible: true
          }
        },
        {
          name: 'Footer Links',
          description: 'Footer navigation links',
          structure: {
            columns: 'array',
            showSocial: 'boolean',
            showNewsletter: 'boolean'
          },
          defaultContent: {
            columns: [
              {
                title: 'Customer Service',
                links: [
                  { label: 'Contact Us', url: '/contact' },
                  { label: 'Shipping Info', url: '/shipping' },
                  { label: 'Returns', url: '/returns' }
                ]
              }
            ],
            showSocial: true,
            showNewsletter: true
          }
        }
      ]
    };

    if (type && templates[type]) {
      res.json({
        success: true,
        templates: templates[type]
      });
    } else {
      res.json({
        success: true,
        templates
      });
    }
  } catch (error) {
    console.error('Error in getContentTemplates:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Preview content
// @route   GET /api/content/admin/:id/preview
// @access  Private/Admin
exports.previewContent = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    // Return content for preview (ignoring active status and date restrictions)
    res.json({
      success: true,
      content,
      preview: true
    });
  } catch (error) {
    console.error('Error in previewContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create content from template (Admin)
// @route   POST /api/content/admin/create-from-template
// @access  Private/Admin
exports.createContentFromTemplate = async (req, res) => {
  try {
    const { templateName, templateType, customizations = {} } = req.body;

    if (!templateName || !templateType) {
      return res.status(400).json({
        success: false,
        message: 'Template name and type are required'
      });
    }

    // Get template data
    const templatesResponse = await exports.getContentTemplates({ query: { type: templateType } }, { json: () => {} });
    const templates = templatesResponse.success ? templatesResponse.templates : [];
    
    const template = templates.find(t => t.name === templateName);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Merge template default content with customizations
    const contentData = {
      ...template.defaultContent,
      ...customizations
    };

    // Create content
    const content = new Content({
      type: templateType,
      name: customizations.name || `${templateName} - ${Date.now()}`,
      content: contentData,
      position: customizations.position || 'main',
      isActive: false // Start inactive for review
    });

    await content.save();

    res.status(201).json({
      success: true,
      message: 'Content created from template successfully',
      content
    });
  } catch (error) {
    console.error('Error in createContentFromTemplate:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Publish content (Admin)
// @route   PATCH /api/content/admin/:id/publish
// @access  Private/Admin
// @desc    Publish content (Admin)
// @route   PATCH /api/content/admin/:id/publish
// @access  Private/Admin
exports.publishContent = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    content.isActive = true;
    
    // If no start date is set, publish immediately
    if (!content.startDate) {
      content.startDate = new Date();
    }

    await content.save();

    res.json({
      success: true,
      message: 'Content published successfully',
      content: {
        id: content._id,
        name: content.name,
        isActive: content.isActive,
        startDate: content.startDate
      }
    });
  } catch (error) {
    console.error('Error in publishContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Unpublish content (Admin)
// @route   PATCH /api/content/admin/:id/unpublish
// @access  Private/Admin
exports.unpublishContent = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    content.isActive = false;
    await content.save();

    res.json({
      success: true,
      message: 'Content unpublished successfully',
      content: {
        id: content._id,
        name: content.name,
        isActive: content.isActive
      }
    });
  } catch (error) {
    console.error('Error in unpublishContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Archive content (Admin)
// @route   PATCH /api/content/admin/:id/archive
// @access  Private/Admin
exports.archiveContent = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    content.isActive = false;
    content.endDate = new Date(); // Set end date to now
    await content.save();

    res.json({
      success: true,
      message: 'Content archived successfully',
      content: {
        id: content._id,
        name: content.name,
        isActive: content.isActive,
        endDate: content.endDate
      }
    });
  } catch (error) {
    console.error('Error in archiveContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Bulk update content (Admin)
// @route   PATCH /api/content/admin/bulk-update
// @access  Private/Admin
exports.bulkUpdateContent = async (req, res) => {
  try {
    const { contentIds, updates } = req.body;

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Content IDs array is required'
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Updates object is required'
      });
    }

    // Validate allowed bulk update fields
    const allowedFields = ['isActive', 'position', 'targetAudience', 'displayOrder'];
    const filteredUpdates = {};
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid update fields provided'
      });
    }

    const result = await Content.updateMany(
      { _id: { $in: contentIds } },
      { $set: filteredUpdates }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} content items updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in bulkUpdateContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Search content (Admin)
// @route   GET /api/content/admin/search
// @access  Private/Admin
exports.searchContent = async (req, res) => {
  try {
    const { q, type, position, status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Build search query
    const searchQuery = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { slug: { $regex: q, $options: 'i' } },
        { type: { $regex: q, $options: 'i' } },
        { position: { $regex: q, $options: 'i' } }
      ]
    };

    // Add additional filters
    if (type) {
      searchQuery.type = type;
    }

    if (position) {
      searchQuery.position = position;
    }

    if (status) {
      if (status === 'active') {
        searchQuery.isActive = true;
      } else if (status === 'inactive') {
        searchQuery.isActive = false;
      }
    }

    const content = await Content.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Content.countDocuments(searchQuery);

    res.json({
      success: true,
      query: q,
      content,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in searchContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get content statistics (Admin)
// @route   GET /api/content/admin/statistics
// @access  Private/Admin
exports.getContentStatistics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get content statistics
    const stats = await Content.aggregate([
      {
        $facet: {
          totalStats: [
            {
              $group: {
                _id: null,
                totalContent: { $sum: 1 },
                activeContent: { $sum: { $cond: ['$isActive', 1, 0] } },
                scheduledContent: {
                  $sum: {
                    $cond: [
                      { $gt: ['$startDate', new Date()] },
                      1,
                      0
                    ]
                  }
                },
                expiredContent: {
                  $sum: {
                    $cond: [
                      { $lt: ['$endDate', new Date()] },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ],
          typeStats: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
                active: { $sum: { $cond: ['$isActive', 1, 0] } }
              }
            }
          ],
          positionStats: [
            {
              $group: {
                _id: '$position',
                count: { $sum: 1 }
              }
            }
          ],
          recentContent: [
            {
              $match: {
                createdAt: { $gte: startDate }
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                  day: { $dayOfMonth: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            {
              $project: {
                date: {
                  $dateFromParts: {
                    year: '$_id.year',
                    month: '$_id.month',
                    day: '$_id.day'
                  }
                },
                count: 1
              }
            },
            { $sort: { date: 1 } }
          ]
        }
      }
    ]);

    const result = stats[0];

    res.json({
      success: true,
      period,
      statistics: {
        total: result.totalStats[0] || {
          totalContent: 0,
          activeContent: 0,
          scheduledContent: 0,
          expiredContent: 0
        },
        byType: result.typeStats,
        byPosition: result.positionStats,
        timeline: result.recentContent
      }
    });
  } catch (error) {
    console.error('Error in getContentStatistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Export content (Admin)
// @route   GET /api/content/admin/export
// @access  Private/Admin
exports.exportContent = async (req, res) => {
  try {
    const { format = 'json', type, position, active } = req.query;

    // Build query
    const query = {};
    if (type) query.type = type;
    if (position) query.position = position;
    if (active !== undefined) query.isActive = active === 'true';

    const content = await Content.find(query)
      .sort({ type: 1, displayOrder: 1, createdAt: -1 })
      .lean();

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = content.map(item => ({
        'ID': item._id,
        'Name': item.name,
        'Type': item.type,
        'Position': item.position || '',
        'Active': item.isActive ? 'Yes' : 'No',
        'Display Order': item.displayOrder,
        'Start Date': item.startDate ? item.startDate.toISOString().split('T')[0] : '',
        'End Date': item.endDate ? item.endDate.toISOString().split('T')[0] : '',
        'Target Audience': item.targetAudience || 'all',
        'Created': item.createdAt.toISOString().split('T')[0],
        'Updated': item.updatedAt.toISOString().split('T')[0]
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="content-export-${Date.now()}.csv"`);
      
      const csvHeaders = Object.keys(csvData[0] || {}).join(',');
      const csvRows = csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','));
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      
      res.send(csvContent);
    } else {
      // Return JSON
      res.json({
        success: true,
        count: content.length,
        content,
        exportedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error in exportContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Validate content structure (Admin)
// @route   POST /api/content/admin/validate
// @access  Private/Admin
exports.validateContent = async (req, res) => {
  try {
    const { type, content } = req.body;

    if (!type || !content) {
      return res.status(400).json({
        success: false,
        message: 'Type and content are required'
      });
    }

    // Get template structure for validation
    const templates = {
      hero: {
        required: ['title'],
        optional: ['subtitle', 'backgroundImage', 'ctaText', 'ctaLink', 'overlay']
      },
      banner: {
        required: ['message'],
        optional: ['backgroundColor', 'textColor', 'link', 'ctaText', 'dismissible']
      },
      block: {
        required: ['title'],
        optional: ['content', 'alignment', 'backgroundColor']
      },
      page: {
        required: ['title', 'content'],
        optional: ['sidebar', 'breadcrumbs', 'toc']
      },
      announcement: {
        required: ['message'],
        optional: ['type', 'showIcon', 'dismissible', 'link']
      }
    };

    const template = templates[type];
    if (!template) {
      return res.status(400).json({
        success: false,
        message: 'Invalid content type'
      });
    }

    const errors = [];
    const warnings = [];

    // Check required fields
    template.required.forEach(field => {
      if (!content[field] || content[field] === '') {
        errors.push(`Required field '${field}' is missing or empty`);
      }
    });

    // Check for unknown fields
    const allAllowedFields = [...template.required, ...template.optional];
    Object.keys(content).forEach(field => {
      if (!allAllowedFields.includes(field)) {
        warnings.push(`Unknown field '${field}' will be ignored`);
      }
    });

    // Type-specific validations
    if (type === 'hero') {
      if (content.ctaText && !content.ctaLink) {
        warnings.push('CTA text provided but no CTA link specified');
      }
    }

    if (type === 'banner') {
      if (content.backgroundColor && !/^#[0-9A-F]{6}$/i.test(content.backgroundColor)) {
        warnings.push('Background color should be a valid hex color code');
      }
    }

    const isValid = errors.length === 0;

    res.json({
      success: true,
      valid: isValid,
      errors,
      warnings,
      message: isValid ? 'Content structure is valid' : 'Content structure has errors'
    });
  } catch (error) {
    console.error('Error in validateContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}; startDate: { $exists: false } },
        { startDate: { $lte: now } }
      ];
      query.$and = [
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: now } }
          ]
        }
      ];
    }

    const content = await Content.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: content.length,
      content
    });
  } catch (error) {
    console.error('Error in getContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get content by slug
// @route   GET /api/content/slug/:slug
// @access  Public
exports.getContentBySlug = async (req, res) => {
  try {
    const content = await Content.findOne({ 
      slug: req.params.slug,
      isActive: true 
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    // Check if content is within date range
    const now = new Date();
    if (content.startDate && content.startDate > now) {
      return res.status(404).json({
        success: false,
        message: 'Content not available yet'
      });
    }

    if (content.endDate && content.endDate < now) {
      return res.status(404).json({
        success: false,
        message: 'Content no longer available'
      });
    }

    res.json({
      success: true,
      content
    });
  } catch (error) {
    console.error('Error in getContentBySlug:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get content by ID
// @route   GET /api/content/:id
// @access  Public
exports.getContentById = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    // For public access, check if content is active and within date range
    if (!req.user || req.user.role !== 'admin') {
      if (!content.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Content not found'
        });
      }

      const now = new Date();
      if (content.startDate && content.startDate > now) {
        return res.status(404).json({
          success: false,
          message: 'Content not available yet'
        });
      }

      if (content.endDate && content.endDate < now) {
        return res.status(404).json({
          success: false,
          message: 'Content no longer available'
        });
      }
    }

    res.json({
      success: true,
      content
    });
  } catch (error) {
    console.error('Error in getContentById:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get hero content
// @route   GET /api/content/hero
// @access  Public
exports.getHeroContent = async (req, res) => {
  try {
    const now = new Date();
    const heroContent = await Content.find({
      type: 'hero',
      isActive: true,
      $or: [
        { startDate: { $exists: false } },
        { startDate: { $lte: now } }
      ],
      $and: [
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: now } }
          ]
        }
      ]
    })
    .sort({ displayOrder: 1 })
    .limit(5)
    .lean();

    res.json({
      success: true,
      count: heroContent.length,
      content: heroContent
    });
  } catch (error) {
    console.error('Error in getHeroContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get announcements
// @route   GET /api/content/announcements
// @access  Public
exports.getAnnouncements = async (req, res) => {
  try {
    const now = new Date();
    const announcements = await Content.find({
      type: 'announcement',
      isActive: true,
      $or: [
        { startDate: { $exists: false } },
        { startDate: { $lte: now } }
      ],
      $and: [
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: now } }
          ]
        }
      ]
    })
    .sort({ displayOrder: 1, createdAt: -1 })
    .lean();

    res.json({
      success: true,
      count: announcements.length,
      announcements
    });
  } catch (error) {
    console.error('Error in getAnnouncements:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create content (Admin)
// @route   POST /api/content/admin/create
// @access  Private/Admin
exports.createContent = async (req, res) => {
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
    const existingContent = await Content.findOne({ slug: req.body.slug });
    if (existingContent) {
      req.body.slug = `${req.body.slug}-${Date.now()}`;
    }

    const content = new Content(req.body);
    await content.save();

    res.status(201).json({
      success: true,
      message: 'Content created successfully',
      content
    });
  } catch (error) {
    console.error('Error in createContent:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Content slug already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update content (Admin)
// @route   PUT /api/content/admin/:id
// @access  Private/Admin
exports.updateContent = async (req, res) => {
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
      const existingContent = await Content.findOne({ 
        slug: req.body.slug,
        _id: { $ne: req.params.id }
      });
      
      if (existingContent) {
        req.body.slug = `${req.body.slug}-${Date.now()}`;
      }
    }

    const content = await Content.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      message: 'Content updated successfully',
      content
    });
  } catch (error) {
    console.error('Error in updateContent:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Content slug already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete content (Admin)
// @route   DELETE /api/content/admin/:id
// @access  Private/Admin
exports.deleteContent = async (req, res) => {
  try {
    const content = await Content.findByIdAndDelete(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      message: 'Content deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteContent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Toggle content status (Admin)
// @route   PATCH /api/content/admin/:id/toggle-status
// @access  Private/Admin
exports.toggleContentStatus = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    content.isActive = !content.isActive;
    await content.save();

    res.json({
      success: true,
      message: `Content ${content.isActive ? 'activated' : 'deactivated'} successfully`,
      content: {
        id: content._id,
        name: content.name,
        isActive: content.isActive
      }
    });
  } catch (error) {
    console.error('Error in toggleContentStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all content (Admin)
// @route   GET /api/content/admin/all
// @access  Private/Admin
exports.getAllContentAdmin = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type,
      position,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateFrom,
      dateTo
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    if (type) {
      query.type = type;
    }
    
    if (position) {
      query.position = position;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }
    
    // Status filtering with enhanced logic
    const now = new Date();
    if (status) {
      switch (status) {
        case 'active':
          query.isActive = true;
          query.$or = [
            { startDate: { $exists: false } },
            { startDate: { $lte: now } }
          ];
          query.$and = [{
            $or: [
              { endDate: { $exists: false } },
              { endDate: { $gte: now } }
            ]
          }];
          break;
        case 'inactive':
          query.isActive = false;
          break;
        case 'scheduled':
          query.isActive = true;
          query.startDate = { $gt: now };
          break;
        case 'expired':
          query.endDate = { $lt: now };
          break;
        case 'draft':
          query.isActive = false;
          query.startDate = { $exists: false };
          break;
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } },
        { targetAudience: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // If sorting by displayOrder, add secondary sort
    if (sortBy === 'displayOrder') {
      sortObj.type = 1;
      sortObj.createdAt = -1;
    }

    const content = await Content.find(query)
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Enhance content with computed status
    const enhancedContent = content.map(item => {
      let computedStatus = 'inactive';
      
      if (item.isActive) {
        const hasStarted = !item.startDate || item.startDate <= now;
        const hasEnded = item.endDate && item.endDate <= now;
        
        if (!hasStarted) {
          computedStatus = 'scheduled';
        } else if (hasEnded) {
          computedStatus = 'expired';
        } else {
          computedStatus = 'active';
        }
      } else {
        computedStatus = item.startDate ? 'draft' : 'inactive';
      }

      return {
        ...item,
        computedStatus,
        daysUntilStart: item.startDate ? Math.ceil((item.startDate - now) / (1000 * 60 * 60 * 24)) : null,
        daysUntilEnd: item.endDate ? Math.ceil((item.endDate - now) / (1000 * 60 * 60 * 24)) : null
      };
    });

    const total = await Content.countDocuments(query);

    // Get comprehensive statistics
    const [typeStats, statusStats, positionStats, recentActivity] = await Promise.all([
      // Type statistics
      Content.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            active: { $sum: { $cond: ['$isActive', 1, 0] } },
            inactive: { $sum: { $cond: ['$isActive', 0, 1] } }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Status statistics
      Content.aggregate([
        {
          $project: {
            status: {
              $cond: [
                { $eq: ['$isActive', false] },
                { $cond: [{ $exists: ['$startDate'] }, 'draft', 'inactive'] },
                {
                  $cond: [
                    { $and: [
                      { $ifNull: ['$startDate', true] },
                      { $or: [
                        { $eq: ['$startDate', null] },
                        { $lte: ['$startDate', now] }
                      ]}
                    ]},
                    {
                      $cond: [
                        { $and: [
                          { $ifNull: ['$endDate', true] },
                          { $or: [
                            { $eq: ['$endDate', null] },
                            { $gte: ['$endDate', now] }
                          ]}
                        ]},
                        'active',
                        'expired'
                      ]
                    },
                    'scheduled'
                  ]
                }
              ]
            }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // Position statistics
      Content.aggregate([
        {
          $group: {
            _id: '$position',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Recent activity (last 7 days)
      Content.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: '$_id.day'
              }
            },
            count: 1
          }
        },
        { $sort: { date: 1 } }
      ])
    ]);

    // Get upcoming scheduled content
    const upcomingScheduled = await Content.find({
      isActive: true,
      startDate: { $gt: now }
    })
    .sort({ startDate: 1 })
    .limit(5)
    .select('name type startDate position')
    .lean();

    // Get expiring content (next 7 days)
    const expiringContent = await Content.find({
      isActive: true,
      endDate: { 
        $gte: now,
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })
    .sort({ endDate: 1 })
    .limit(5)
    .select('name type endDate position')
    .lean();

    res.json({
      success: true,
      content: enhancedContent,
      total,
      stats: {
        byType: typeStats,
        byStatus: statusStats,
        byPosition: positionStats,
        overview: {
          total: total,
          active: statusStats.find(s => s._id === 'active')?.count || 0,
          inactive: statusStats.find(s => s._id === 'inactive')?.count || 0,
          scheduled: statusStats.find(s => s._id === 'scheduled')?.count || 0,
          expired: statusStats.find(s => s._id === 'expired')?.count || 0,
          draft: statusStats.find(s => s._id === 'draft')?.count || 0
        }
      },
      activity: {
        recent: recentActivity,
        upcoming: upcomingScheduled,
        expiring: expiringContent
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      },
      filters: {
        types: [...new Set(content.map(c => c.type))],
        positions: [...new Set(content.map(c => c.position).filter(Boolean))],
        statuses: ['active', 'inactive', 'scheduled', 'expired', 'draft']
      }
    });
  } catch (error) {
    console.error('Error in getAllContentAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
      