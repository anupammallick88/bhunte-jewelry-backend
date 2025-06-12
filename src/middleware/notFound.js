const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: {
      auth: '/api/auth',
      products: '/api/products',
      categories: '/api/categories',
      collections: '/api/collections',
      cart: '/api/cart',
      orders: '/api/orders',
      reviews: '/api/reviews',
      wishlist: '/api/wishlist',
      users: '/api/users',
      customerStories: '/api/customer-stories',
      newsletter: '/api/newsletter',
      blog: '/api/blog',
      coupons: '/api/coupons',
      content: '/api/content',
      analytics: '/api/analytics',
      settings: '/api/settings',
      admin: '/api/admin'
    }
  });
};

module.exports = notFound;