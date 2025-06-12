const redis = require('redis');

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB) || 0,
  
  // Connection options
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  
  // Cache TTL settings (in seconds)
  ttl: {
    short: 300,      // 5 minutes
    medium: 1800,    // 30 minutes
    long: 3600,      // 1 hour
    veryLong: 86400  // 24 hours
  }
};

// Create Redis client
let redisClient = null;

const createRedisClient = () => {
  try {
    const client = redis.createClient({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
      },
      password: redisConfig.password,
      database: redisConfig.db
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      console.log('✅ Redis connected');
    });

    client.on('disconnect', () => {
      console.log('Redis disconnected');
    });

    return client;
  } catch (error) {
    console.error('Redis client creation error:', error);
    return null;
  }
};

// Redis utility functions
const redisUtils = {
  // Initialize Redis connection
  init: async () => {
    try {
      redisClient = createRedisClient();
      if (redisClient) {
        await redisClient.connect();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Redis initialization error:', error);
      return false;
    }
  },

  // Check if Redis is connected
  isConnected: () => {
    return redisClient && redisClient.isReady;
  },

  // Set cache with TTL
  setCache: async (key, value, ttl = redisConfig.ttl.medium) => {
    try {
      if (!redisUtils.isConnected()) return false;
      
      const serializedValue = JSON.stringify(value);
      await redisClient.setEx(key, ttl, serializedValue);
      return true;
    } catch (error) {
      console.error('Redis set cache error:', error);
      return false;
    }
  },

  // Get cache
  getCache: async (key) => {
    try {
      if (!redisUtils.isConnected()) return null;
      
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get cache error:', error);
      return null;
    }
  },

  // Delete cache
  deleteCache: async (key) => {
    try {
      if (!redisUtils.isConnected()) return false;
      
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Redis delete cache error:', error);
      return false;
    }
  },

  // Clear all cache with pattern
  clearCacheByPattern: async (pattern) => {
    try {
      if (!redisUtils.isConnected()) return false;
      
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis clear cache by pattern error:', error);
      return false;
    }
  },

  // Set hash
  setHash: async (key, field, value, ttl = redisConfig.ttl.medium) => {
    try {
      if (!redisUtils.isConnected()) return false;
      
      await redisClient.hSet(key, field, JSON.stringify(value));
      await redisClient.expire(key, ttl);
      return true;
    } catch (error) {
      console.error('Redis set hash error:', error);
      return false;
    }
  },

  // Get hash field
  getHash: async (key, field) => {
    try {
      if (!redisUtils.isConnected()) return null;
      
      const value = await redisClient.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get hash error:', error);
      return null;
    }
  },

  // Get all hash fields
  getAllHash: async (key) => {
    try {
      if (!redisUtils.isConnected()) return null;
      
      const hash = await redisClient.hGetAll(key);
      const result = {};
      
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      
      return result;
    } catch (error) {
      console.error('Redis get all hash error:', error);
      return null;
    }
  },

  // Close connection
  close: async () => {
    try {
      if (redisClient) {
        await redisClient.quit();
        redisClient = null;
      }
    } catch (error) {
      console.error('Redis close error:', error);
    }
  }
};

// Cache middleware
const cacheMiddleware = (ttl = redisConfig.ttl.medium) => {
  return async (req, res, next) => {
    try {
      if (!redisUtils.isConnected()) {
        return next();
      }

      const cacheKey = `cache:${req.originalUrl}:${JSON.stringify(req.query)}`;
      const cachedData = await redisUtils.getCache(cacheKey);

      if (cachedData) {
        return res.json(cachedData);
      }

      // Store original res.json
      const originalJson = res.json;
      
      // Override res.json to cache the response
      res.json = function(data) {
        // Cache successful responses only
        if (res.statusCode === 200 && data.success !== false) {
          redisUtils.setCache(cacheKey, data, ttl);
        }
        
        // Call original res.json
        originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

module.exports = {
  redisConfig,
  redisUtils,
  cacheMiddleware,
  createRedisClient
};