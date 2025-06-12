const Analytics = require('../models/Analytics');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Track analytics event
// @route   POST /api/analytics/track
// @access  Public
exports.trackEvent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      type,
      productId,
      orderId,
      page,
      referrer,
      data,
      revenue
    } = req.body;

    // Get session ID from headers or generate one
    const sessionId = req.headers['session-id'] || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const analyticsEvent = new Analytics({
      type,
      sessionId,
      userId: req.user ? req.user.id : null,
      productId: productId || null,
      orderId: orderId || null,
      page,
      referrer,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      data: data || {},
      revenue: revenue || null
    });

    await analyticsEvent.save();

    res.json({
      success: true,
      message: 'Event tracked successfully',
      sessionId
    });
  } catch (error) {
    console.error('Error in trackEvent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get analytics dashboard data (Admin)
// @route   GET /api/analytics/admin/dashboard
// @access  Private/Admin
exports.getDashboardAnalytics = async (req, res) => {
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
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get overall metrics
    const [
      totalPageViews,
      uniqueVisitors,
      totalRevenue,
      conversionRate
    ] = await Promise.all([
      Analytics.countDocuments({
        type: 'page_view',
        timestamp: { $gte: startDate }
      }),
      Analytics.distinct('sessionId', {
        timestamp: { $gte: startDate }
      }).then(sessions => sessions.length),
      Analytics.aggregate([
        {
          $match: {
            type: 'purchase',
            timestamp: { $gte: startDate },
            revenue: { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$revenue' }
          }
        }
      ]).then(result => result[0]?.total || 0),
      Analytics.aggregate([
        {
          $match: { timestamp: { $gte: startDate } }
        },
        {
          $group: {
            _id: '$sessionId',
            events: { $push: '$type' }
          }
        },
        {
          $project: {
            hasPurchase: { $in: ['purchase', '$events'] }
          }
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            conversions: { $sum: { $cond: ['$hasPurchase', 1, 0] } }
          }
        }
      ]).then(result => {
        const data = result[0];
        return data ? (data.conversions / data.totalSessions) * 100 : 0;
      })
    ]);

    // Get daily page views
    const dailyPageViews = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$sessionId' }
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
          views: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Get top pages
    const topPages = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
          page: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$page',
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          page: '$_id',
          views: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' }
        }
      },
      { $sort: { views: -1 } },
      { $limit: 10 }
    ]);

    // Get top products
    const topProducts = await Analytics.aggregate([
      {
        $match: {
          type: 'product_view',
          timestamp: { $gte: startDate },
          productId: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$productId',
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$sessionId' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          productImage: { $arrayElemAt: ['$product.images.url', 0] },
          views: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' }
        }
      },
      { $sort: { views: -1 } },
      { $limit: 10 }
    ]);

    // Get referrer data
    const topReferrers = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          referrer: { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$referrer',
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          referrer: '$_id',
          visits: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' }
        }
      },
      { $sort: { visits: -1 } },
      { $limit: 10 }
    ]);

    // Get device/browser stats
    const deviceStats = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          userAgent: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            userAgent: '$userAgent',
            sessionId: '$sessionId'
          }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          userAgents: { $push: '$_id.userAgent' }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      metrics: {
        totalPageViews,
        uniqueVisitors,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100
      },
      charts: {
        dailyPageViews,
        topPages,
        topProducts,
        topReferrers
      },
      deviceStats: deviceStats[0] || { totalSessions: 0, userAgents: [] }
    });
  } catch (error) {
    console.error('Error in getDashboardAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get product analytics (Admin)
// @route   GET /api/analytics/admin/products
// @access  Private/Admin
exports.getProductAnalytics = async (req, res) => {
  try {
    const { period = '30d', productId } = req.query;
    
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

    const matchStage = {
      timestamp: { $gte: startDate }
    };

    if (productId) {
      matchStage.productId = mongoose.Types.ObjectId(productId);
    }

    // Product view analytics
    const productViews = await Analytics.aggregate([
      {
        $match: {
          ...matchStage,
          type: 'product_view'
        }
      },
      {
        $group: {
          _id: '$productId',
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$sessionId' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          productPrice: '$product.price',
          views: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' }
        }
      },
      { $sort: { views: -1 } },
      { $limit: 20 }
    ]);

    // Cart events
    const cartEvents = await Analytics.aggregate([
      {
        $match: {
          ...matchStage,
          type: { $in: ['cart_add', 'cart_remove'] }
        }
      },
      {
        $group: {
          _id: {
            productId: '$productId',
            type: '$type'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.productId',
          cartAdds: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'cart_add'] }, '$count', 0] }
          },
          cartRemoves: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'cart_remove'] }, '$count', 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          cartAdds: 1,
          cartRemoves: 1,
          netCartAdds: { $subtract: ['$cartAdds', '$cartRemoves'] }
        }
      },
      { $sort: { cartAdds: -1 } }
    ]);

    // Purchase analytics
    const purchaseData = await Analytics.aggregate([
      {
        $match: {
          ...matchStage,
          type: 'purchase',
          revenue: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$productId',
          purchases: { $sum: 1 },
          revenue: { $sum: '$revenue' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          purchases: 1,
          revenue: 1,
          averageOrderValue: { $divide: ['$revenue', '$purchases'] }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    res.json({
      success: true,
      period,
      productViews,
      cartEvents,
      purchaseData
    });
  } catch (error) {
    console.error('Error in getProductAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get user behavior analytics (Admin)
// @route   GET /api/analytics/admin/users
// @access  Private/Admin
exports.getUserAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
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

    // User session analytics
    const sessionStats = await Analytics.aggregate([
      {
        $match: { timestamp: { $gte: startDate } }
      },
      {
        $group: {
          _id: '$sessionId',
          events: { $push: '$type' },
          startTime: { $min: '$timestamp' },
          endTime: { $max: '$timestamp' },
          userId: { $first: '$userId' }
        }
      },
      {
        $project: {
          sessionId: '$_id',
          eventCount: { $size: '$events' },
          duration: { $subtract: ['$endTime', '$startTime'] },
          isAuthenticated: { $ne: ['$userId', null] },
          hasPurchase: { $in: ['purchase', '$events'] },
          hasCartAdd: { $in: ['cart_add', '$events'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          authenticatedSessions: { $sum: { $cond: ['$isAuthenticated', 1, 0] } },
          purchaseSessions: { $sum: { $cond: ['$hasPurchase', 1, 0] } },
          cartSessions: { $sum: { $cond: ['$hasCartAdd', 1, 0] } },
          averageDuration: { $avg: '$duration' },
          averageEventsPerSession: { $avg: '$eventCount' }
        }
      }
    ]);

    // New vs returning users
    const userTypes = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          userId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$userId',
          firstVisit: { $min: '$timestamp' },
          totalEvents: { $sum: 1 }
        }
      },
      {
        $project: {
          isNewUser: { $gte: ['$firstVisit', startDate] }
        }
      },
      {
        $group: {
          _id: null,
          newUsers: { $sum: { $cond: ['$isNewUser', 1, 0] } },
          returningUsers: { $sum: { $cond: ['$isNewUser', 0, 1] } }
        }
      }
    ]);

    // Top user activities
    const topActivities = await Analytics.aggregate([
      {
        $match: { timestamp: { $gte: startDate } }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Funnel analysis
    const funnelData = await Analytics.aggregate([
      {
        $match: { timestamp: { $gte: startDate } }
      },
      {
        $group: {
          _id: '$sessionId',
          events: { $addToSet: '$type' }
        }
      },
      {
        $project: {
          hasPageView: { $in: ['page_view', '$events'] },
          hasProductView: { $in: ['product_view', '$events'] },
          hasCartAdd: { $in: ['cart_add', '$events'] },
          hasCheckoutStart: { $in: ['checkout_start', '$events'] },
          hasPurchase: { $in: ['purchase', '$events'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          pageViews: { $sum: { $cond: ['$hasPageView', 1, 0] } },
          productViews: { $sum: { $cond: ['$hasProductView', 1, 0] } },
          cartAdds: { $sum: { $cond: ['$hasCartAdd', 1, 0] } },
          checkoutStarts: { $sum: { $cond: ['$hasCheckoutStart', 1, 0] } },
          purchases: { $sum: { $cond: ['$hasPurchase', 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      sessionStats: sessionStats[0] || {},
      userTypes: userTypes[0] || { newUsers: 0, returningUsers: 0 },
      topActivities,
      funnelData: funnelData[0] || {}
    });
  } catch (error) {
    console.error('Error in getUserAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get real-time analytics (Admin)
// @route   GET /api/analytics/admin/realtime
// @access  Private/Admin
exports.getRealtimeAnalytics = async (req, res) => {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    // Active sessions (last hour)
    const activeSessions = await Analytics.distinct('sessionId', {
      timestamp: { $gte: lastHour }
    });

    // Recent events (last 24 hours)
    const recentEvents = await Analytics.find({
      timestamp: { $gte: last24Hours }
    })
    .sort({ timestamp: -1 })
    .limit(50)
    .populate('userId', 'firstName lastName')
    .populate('productId', 'name')
    .lean();

    // Hourly data for last 24 hours
    const hourlyData = await Analytics.aggregate([
      {
        $match: { timestamp: { $gte: last24Hours } }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$timestamp' },
            type: '$type'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.hour',
          events: {
            $push: {
              type: '$_id.type',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Current popular products
    const popularProducts = await Analytics.aggregate([
      {
        $match: {
          type: 'product_view',
          timestamp: { $gte: lastHour },
          productId: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$productId',
          views: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productName: '$product.name',
          views: 1
        }
      },
      { $sort: { views: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      activeSessions: activeSessions.length,
      recentEvents,
      hourlyData,
      popularProducts
    });
  } catch (error) {
    console.error('Error in getRealtimeAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Export analytics data (Admin)
// @route   GET /api/analytics/admin/export
// @access  Private/Admin
exports.exportAnalytics = async (req, res) => {
  try {
    const { 
      format = 'csv',
      period = '30d',
      type,
      dateFrom,
      dateTo 
    } = req.query;

    let startDate = new Date();
    let endDate = new Date();

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom);
      endDate = new Date(dateTo);
    } else {
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
    }

    const query = {
      timestamp: { $gte: startDate, $lte: endDate }
    };

    if (type) {
      query.type = type;
    }

    const analytics = await Analytics.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('productId', 'name sku')
      .populate('orderId', 'orderNumber')
      .sort({ timestamp: -1 })
      .lean();

    if (format === 'csv') {
      const csvData = analytics.map(event => ({
        'Timestamp': event.timestamp.toISOString(),
        'Type': event.type,
        'Session ID': event.sessionId,
        'User': event.userId ? `${event.userId.firstName} ${event.userId.lastName}` : 'Anonymous',
        'User Email': event.userId?.email || '',
        'Product': event.productId?.name || '',
        'Product SKU': event.productId?.sku || '',
        'Order': event.orderId?.orderNumber || '',
        'Page': event.page || '',
        'Referrer': event.referrer || '',
        'Revenue': event.revenue || '',
        'IP Address': event.ipAddress || '',
        'User Agent': event.userAgent || ''
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${Date.now()}.csv"`);
      
      const csvHeaders = Object.keys(csvData[0] || {}).join(',');
      const csvRows = csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','));
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        count: analytics.length,
        period: { startDate, endDate },
        analytics
      });
    }
  } catch (error) {
    console.error('Error in exportAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};