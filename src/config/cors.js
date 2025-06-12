const corsConfig = {
  // CORS configuration
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:8080',
      'https://angara.com',
      'https://www.angara.com',
      'https://admin.angara.com',
      'https://app.angara.com',
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  credentials: true,
  optionsSuccessStatus: 200,
  
  methods: [
    'GET',
    'POST', 
    'PUT',
    'DELETE',
    'PATCH',
    'OPTIONS',
    'HEAD'
  ],
  
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'session-id',
    'x-api-key',
    'x-client-version'
  ],
  
  exposedHeaders: [
    'Content-Length',
    'X-Total-Count',
    'X-Page-Count',
    'Link'
  ],
  
  // Preflight cache duration (in seconds)
  maxAge: 86400 // 24 hours
};

// Development CORS (more permissive)
const developmentCorsConfig = {
  origin: true,
  credentials: true,
  methods: '*',
  allowedHeaders: '*'
};

// Get CORS config based on environment
const getCorsConfig = () => {
  return process.env.NODE_ENV === 'development' 
    ? developmentCorsConfig 
    : corsConfig;
};

module.exports = {
  corsConfig,
  developmentCorsConfig,
  getCorsConfig
};