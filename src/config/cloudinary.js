const cloudinary = require('cloudinary').v2;

// Cloudinary configuration
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
};

// Configure Cloudinary
cloudinary.config(cloudinaryConfig);

// Upload presets for different types of content
const uploadPresets = {
  products: {
    folder: 'angara/products',
    transformation: [
      { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' },
      { format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    max_file_size: 10000000, // 10MB
    tags: ['product', 'jewelry']
  },

  users: {
    folder: 'angara/users',
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto:good' },
      { format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png'],
    max_file_size: 2000000, // 2MB
    tags: ['user', 'avatar']
  },

  blog: {
    folder: 'angara/blog',
    transformation: [
      { width: 1200, height: 800, crop: 'limit', quality: 'auto:good' },
      { format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    max_file_size: 5000000, // 5MB
    tags: ['blog', 'content']
  },

  stories: {
    folder: 'angara/customer-stories',
    transformation: [
      { width: 1000, height: 1000, crop: 'limit', quality: 'auto:good' },
      { format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    max_file_size: 8000000, // 8MB
    tags: ['customer-story', 'user-content']
  },

  content: {
    folder: 'angara/content',
    transformation: [
      { width: 1920, height: 1080, crop: 'limit', quality: 'auto:good' },
      { format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov'],
    max_file_size: 20000000, // 20MB
    tags: ['content', 'cms']
  },

  reviews: {
    folder: 'angara/reviews',
    transformation: [
      { width: 800, height: 800, crop: 'limit', quality: 'auto:good' },
      { format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    max_file_size: 5000000, // 5MB
    tags: ['review', 'user-content']
  }
};

// Cloudinary utility functions
const cloudinaryUtils = {
  // Upload single file
  uploadFile: async (file, preset = 'products', options = {}) => {
    try {
      const uploadOptions = {
        ...uploadPresets[preset],
        ...options,
        use_filename: true,
        unique_filename: true
      };

      let result;
      
      if (file.buffer) {
        // Upload from buffer
        result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(file.buffer);
        });
      } else if (file.path) {
        // Upload from file path
        result = await cloudinary.uploader.upload(file.path, uploadOptions);
      } else {
        throw new Error('Invalid file format');
      }

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        resource_type: result.resource_type,
        bytes: result.bytes,
        created_at: result.created_at
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  },

  // Upload multiple files
  uploadMultiple: async (files, preset = 'products', options = {}) => {
    try {
      const uploadPromises = files.map(file => 
        cloudinaryUtils.uploadFile(file, preset, options)
      );
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Cloudinary multiple upload error:', error);
      throw error;
    }
  },

  // Delete file
  deleteFile: async (publicId, resourceType = 'image') => {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });
      return result.result === 'ok';
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  },

  // Delete multiple files
  deleteMultiple: async (publicIds, resourceType = 'image') => {
    try {
      const result = await cloudinary.api.delete_resources(publicIds, {
        resource_type: resourceType
      });
      return result;
    } catch (error) {
      console.error('Cloudinary multiple delete error:', error);
      throw new Error(`Multiple delete failed: ${error.message}`);
    }
  },

  // Generate transformation URL
  generateUrl: (publicId, transformations = {}) => {
    return cloudinary.url(publicId, {
      secure: true,
      ...transformations
    });
  },

  // Get optimized URL for responsive images
  getResponsiveUrl: (publicId, width = 'auto', quality = 'auto:good') => {
    return cloudinary.url(publicId, {
      secure: true,
      width: width,
      crop: 'scale',
      quality: quality,
      format: 'auto'
    });
  },

  // Create image variants for different screen sizes
  createImageVariants: (publicId) => {
    const variants = {
      thumbnail: cloudinary.url(publicId, {
        secure: true,
        width: 150,
        height: 150,
        crop: 'fill',
        quality: 'auto:good',
        format: 'auto'
      }),
      small: cloudinary.url(publicId, {
        secure: true,
        width: 400,
        height: 400,
        crop: 'limit',
        quality: 'auto:good',
        format: 'auto'
      }),
      medium: cloudinary.url(publicId, {
        secure: true,
        width: 800,
        height: 800,
        crop: 'limit',
        quality: 'auto:good',
        format: 'auto'
      }),
      large: cloudinary.url(publicId, {
        secure: true,
        width: 1200,
        height: 1200,
        crop: 'limit',
        quality: 'auto:good',
        format: 'auto'
      }),
      original: cloudinary.url(publicId, {
        secure: true,
        quality: 'auto:best',
        format: 'auto'
      })
    };
    return variants;
  },

  // Get folder contents
  getFolderContents: async (folder) => {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: 500
      });
      return result.resources;
    } catch (error) {
      console.error('Cloudinary folder listing error:', error);
      throw new Error(`Folder listing failed: ${error.message}`);
    }
  },

  // Get upload usage statistics
  getUsageStats: async () => {
    try {
      const result = await cloudinary.api.usage();
      return {
        credits: result.credits,
        used_percent: result.used_percent,
        limit: result.limit,
        storage: result.storage,
        bandwidth: result.bandwidth,
        requests: result.requests
      };
    } catch (error) {
      console.error('Cloudinary usage stats error:', error);
      throw new Error(`Usage stats failed: ${error.message}`);
    }
  }
};

// Validate Cloudinary configuration
const validateConfig = () => {
  const requiredKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = requiredKeys.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`Missing Cloudinary configuration: ${missing.join(', ')}`);
    return false;
  }
  return true;
};

// Test Cloudinary connection
const testConnection = async () => {
  try {
    await cloudinary.api.ping();
    console.log('✅ Cloudinary connection successful');
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error.message);
    return false;
  }
};

module.exports = {
  cloudinary,
  cloudinaryConfig,
  uploadPresets,
  cloudinaryUtils,
  validateConfig,
  testConnection
};