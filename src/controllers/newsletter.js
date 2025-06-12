const Newsletter = require('../models/Newsletter');
const { validationResult } = require('express-validator');
const emailService = require('../services/emailService');

// @desc    Subscribe to newsletter
// @route   POST /api/newsletter/subscribe
// @access  Public
exports.subscribe = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, firstName, lastName, preferences, source = 'website' } = req.body;

    // Check if email already exists
    let subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

    if (subscriber) {
      if (subscriber.status === 'subscribed') {
        return res.json({
          success: true,
          message: 'You are already subscribed to our newsletter'
        });
      } else {
        // Resubscribe
        subscriber.status = 'subscribed';
        subscriber.firstName = firstName || subscriber.firstName;
        subscriber.lastName = lastName || subscriber.lastName;
        subscriber.preferences = { ...subscriber.preferences, ...preferences };
        subscriber.unsubscribedAt = undefined;
        subscriber.unsubscribeReason = undefined;
        await subscriber.save();

        // Send welcome email
        try {
          await emailService.sendNewsletterWelcome(subscriber.email, subscriber.firstName);
        } catch (emailError) {
          console.error('Welcome email error:', emailError);
        }

        return res.json({
          success: true,
          message: 'Welcome back! You have been resubscribed to our newsletter'
        });
      }
    }

    // Create new subscriber
    subscriber = new Newsletter({
      email: email.toLowerCase(),
      firstName,
      lastName,
      preferences: preferences || {
        newProducts: true,
        promotions: true,
        blogPosts: true,
        customerStories: false
      },
      source
    });

    await subscriber.save();

    // Send welcome email
    try {
      await emailService.sendNewsletterWelcome(subscriber.email, subscriber.firstName);
    } catch (emailError) {
      console.error('Welcome email error:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter! Check your email for confirmation.'
    });
  } catch (error) {
    console.error('Error in newsletter subscribe:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Unsubscribe from newsletter
// @route   POST /api/newsletter/unsubscribe
// @access  Public
exports.unsubscribe = async (req, res) => {
  try {
    const { email, reason } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Email not found in our newsletter list'
      });
    }

    if (subscriber.status === 'unsubscribed') {
      return res.json({
        success: true,
        message: 'You are already unsubscribed from our newsletter'
      });
    }

    subscriber.status = 'unsubscribed';
    subscriber.unsubscribedAt = new Date();
    subscriber.unsubscribeReason = reason;
    await subscriber.save();

    res.json({
      success: true,
      message: 'You have been successfully unsubscribed from our newsletter'
    });
  } catch (error) {
    console.error('Error in newsletter unsubscribe:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update newsletter preferences
// @route   PUT /api/newsletter/preferences
// @access  Public
exports.updatePreferences = async (req, res) => {
  try {
    const { email, preferences } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Email not found in our newsletter list'
      });
    }

    subscriber.preferences = { ...subscriber.preferences, ...preferences };
    await subscriber.save();

    res.json({
      success: true,
      message: 'Newsletter preferences updated successfully',
      preferences: subscriber.preferences
    });
  } catch (error) {
    console.error('Error in updatePreferences:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all newsletter subscribers (Admin)
// @route   GET /api/newsletter/admin/subscribers
// @access  Private/Admin
exports.getAllSubscribers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status,
      source,
      search 
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (source) {
      query.source = source;
    }

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    const subscribers = await Newsletter.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Newsletter.countDocuments(query);

    // Get subscriber statistics
    const stats = await Newsletter.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const sourceStats = await Newsletter.aggregate([
      {
        $match: { status: 'subscribed' }
      },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      subscribers,
      total,
      stats: {
        byStatus: stats,
        bySource: sourceStats
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllSubscribers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Export subscribers (Admin)
// @route   GET /api/newsletter/admin/export
// @access  Private/Admin
exports.exportSubscribers = async (req, res) => {
  try {
    const { status = 'subscribed', format = 'csv' } = req.query;

    const query = { status };
    const subscribers = await Newsletter.find(query)
      .sort({ createdAt: -1 })
      .lean();

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = subscribers.map(subscriber => ({
        'Email': subscriber.email,
        'First Name': subscriber.firstName || '',
        'Last Name': subscriber.lastName || '',
        'Status': subscriber.status,
        'Source': subscriber.source,
        'New Products': subscriber.preferences?.newProducts ? 'Yes' : 'No',
        'Promotions': subscriber.preferences?.promotions ? 'Yes' : 'No',
        'Blog Posts': subscriber.preferences?.blogPosts ? 'Yes' : 'No',
        'Customer Stories': subscriber.preferences?.customerStories ? 'Yes' : 'No',
        'Subscribed Date': subscriber.createdAt.toISOString().split('T')[0],
        'Last Email Sent': subscriber.lastEmailSent ? subscriber.lastEmailSent.toISOString().split('T')[0] : ''
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="newsletter-subscribers-${Date.now()}.csv"`);
      
      // Simple CSV conversion
      const csvHeaders = Object.keys(csvData[0] || {}).join(',');
      const csvRows = csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','));
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      
      res.send(csvContent);
    } else {
      // Return JSON
      res.json({
        success: true,
        count: subscribers.length,
        subscribers
      });
    }
  } catch (error) {
    console.error('Error in exportSubscribers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Send newsletter campaign (Admin)
// @route   POST /api/newsletter/admin/send-campaign
// @access  Private/Admin
exports.sendCampaign = async (req, res) => {
  try {
    const { 
      subject, 
      content, 
      recipientType = 'all', 
      tags = [] 
    } = req.body;

    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        message: 'Subject and content are required'
      });
    }

    // Build recipient query
    let query = { status: 'subscribed' };
    
    if (recipientType === 'tagged' && tags.length > 0) {
      query.tags = { $in: tags };
    }

    const recipients = await Newsletter.find(query).lean();

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No recipients found for this campaign'
      });
    }

    // Send emails in batches to avoid overwhelming the email service
    const batchSize = 50;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const emailPromises = batch.map(async (recipient) => {
        try {
          await emailService.sendNewsletterCampaign(
            recipient.email, 
            subject, 
            content, 
            recipient.firstName
          );
          
          // Update last email sent date
          await Newsletter.findByIdAndUpdate(recipient._id, {
            lastEmailSent: new Date()
          });
          
          sentCount++;
        } catch (error) {
          console.error(`Failed to send email to ${recipient.email}:`, error);
          failedCount++;
        }
      });

      await Promise.allSettled(emailPromises);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    res.json({
      success: true,
      message: 'Newsletter campaign completed',
      statistics: {
        totalRecipients: recipients.length,
        sentCount,
        failedCount
      }
    });
  } catch (error) {
    console.error('Error in sendCampaign:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add tags to subscribers (Admin)
// @route   POST /api/newsletter/admin/add-tags
// @access  Private/Admin
exports.addTagsToSubscribers = async (req, res) => {
  try {
    const { emails, tags } = req.body;

    if (!emails || !Array.isArray(emails) || !tags || !Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: 'Emails and tags must be arrays'
      });
    }

    const result = await Newsletter.updateMany(
      { email: { $in: emails.map(email => email.toLowerCase()) } },
      { $addToSet: { tags: { $each: tags } } }
    );

    res.json({
      success: true,
      message: `Tags added to ${result.modifiedCount} subscribers`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in addTagsToSubscribers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};