const jwt = require('jsonwebtoken');

const authConfig = {
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRE || '7d',
    algorithm: 'HS256',
    issuer: 'angara-jewelry',
    audience: 'angara-users'
  },

  // Password configuration
  password: {
    saltRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    minLength: 6,
    maxLength: 128,
    requireStrong: process.env.NODE_ENV === 'production'
  },

  // Session configuration
  session: {
    name: 'angara_session',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    }
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests from this IP, please try again later.'
    }
  },

  // Auth-specific rate limiting
  authRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many authentication attempts, please try again later.'
    }
  },

  // Token blacklist configuration (for logout)
  tokenBlacklist: {
    enabled: true,
    cleanupInterval: 60 * 60 * 1000, // 1 hour
    maxSize: 10000 // Maximum number of blacklisted tokens to keep
  },

  // OAuth configuration (for future use)
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      scopes: ['profile', 'email']
    },
    facebook: {
      appId: process.env.FACEBOOK_APP_ID,
      appSecret: process.env.FACEBOOK_APP_SECRET,
      redirectUri: process.env.FACEBOOK_REDIRECT_URI,
      scopes: ['email', 'public_profile']
    }
  }
};

// JWT utility functions
const jwtUtils = {
  // Generate access token
  generateToken: (payload) => {
    return jwt.sign(payload, authConfig.jwt.secret, {
      expiresIn: authConfig.jwt.expiresIn,
      algorithm: authConfig.jwt.algorithm,
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience
    });
  },

  // Generate refresh token
  generateRefreshToken: (payload) => {
    return jwt.sign(payload, authConfig.jwt.secret, {
      expiresIn: '30d', // Refresh tokens last longer
      algorithm: authConfig.jwt.algorithm,
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience
    });
  },

  // Verify token
  verifyToken: (token) => {
    try {
      return jwt.verify(token, authConfig.jwt.secret, {
        algorithms: [authConfig.jwt.algorithm],
        issuer: authConfig.jwt.issuer,
        audience: authConfig.jwt.audience
      });
    } catch (error) {
      throw new Error('Invalid token');
    }
  },

  // Decode token without verification (for expired tokens)
  decodeToken: (token) => {
    return jwt.decode(token, { complete: true });
  },

  // Get token expiration date
  getTokenExpiration: (token) => {
    const decoded = jwt.decode(token);
    return decoded ? new Date(decoded.exp * 1000) : null;
  }
};

// Token blacklist management
let tokenBlacklist = new Set();

const blacklistUtils = {
  // Add token to blacklist
  addToBlacklist: (token) => {
    if (authConfig.tokenBlacklist.enabled) {
      tokenBlacklist.add(token);
      
      // Clean up old tokens if blacklist gets too large
      if (tokenBlacklist.size > authConfig.tokenBlacklist.maxSize) {
        const tokensArray = Array.from(tokenBlacklist);
        tokenBlacklist = new Set(tokensArray.slice(-authConfig.tokenBlacklist.maxSize / 2));
      }
    }
  },

  // Check if token is blacklisted
  isBlacklisted: (token) => {
    return authConfig.tokenBlacklist.enabled ? tokenBlacklist.has(token) : false;
  },

  // Clear expired tokens from blacklist
  cleanupBlacklist: () => {
    if (!authConfig.tokenBlacklist.enabled) return;

    const now = Date.now() / 1000;
    tokenBlacklist.forEach(token => {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp < now) {
          tokenBlacklist.delete(token);
        }
      } catch (error) {
        // If token can't be decoded, remove it
        tokenBlacklist.delete(token);
      }
    });
  },

  // Get blacklist size
  getBlacklistSize: () => tokenBlacklist.size
};

// Set up periodic cleanup of blacklisted tokens
if (authConfig.tokenBlacklist.enabled) {
  setInterval(() => {
    blacklistUtils.cleanupBlacklist();
  }, authConfig.tokenBlacklist.cleanupInterval);
}

module.exports = {
  authConfig,
  jwtUtils,
  blacklistUtils
};