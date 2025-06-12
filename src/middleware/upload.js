const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Create upload directories
const uploadDir = path.join(__dirname, '../uploads');
const tempDir = path.join(uploadDir, 'temp');
const productDir = path.join(uploadDir, 'products');
const userDir = path.join(uploadDir, 'users');
const contentDir = path.join(uploadDir, 'content');
const blogDir = path.join(uploadDir, 'blog');
const storiesDir = path.join(uploadDir, 'stories');

[uploadDir, tempDir, productDir, userDir, contentDir, blogDir, storiesDir].forEach(ensureDirectoryExists);

// File filter function
const fileFilter = (allowedTypes = ['image']) => {
  return (req, file, cb) => {
    const fileTypes = {
      image: /jpeg|jpg|png|gif|webp/,
      video: /mp4|avi|mov|wmv|flv|webm/,
      document: /pdf|doc|docx|txt/,
      all: /jpeg|jpg|png|gif|webp|mp4|avi|mov|wmv|flv|webm|pdf|doc|docx|txt/
    };

    let allowedExtensions = new RegExp('');
    allowedTypes.forEach(type => {
      if (fileTypes[type]) {
        allowedExtensions = new RegExp(allowedExtensions.source + fileTypes[type].source + '|');
      }
    });
    
    // Remove trailing |
    allowedExtensions = new RegExp(allowedExtensions.source.slice(0, -1));

    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedExtensions.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
    }
  };
};

// Storage configuration for local uploads
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = tempDir;

    // Determine upload path based on route
    if (req.baseUrl.includes('/products')) {
      uploadPath = productDir;
    } else if (req.baseUrl.includes('/users') || req.baseUrl.includes('/auth')) {
      uploadPath = userDir;
    } else if (req.baseUrl.includes('/content')) {
      uploadPath = contentDir;
    } else if (req.baseUrl.includes('/blog')) {
      uploadPath = blogDir;
    } else if (req.baseUrl.includes('/customer-stories')) {
      uploadPath = storiesDir;
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    cb(null, fileName);
  }
});

// Memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();

// Upload configurations
const uploadConfigs = {
  // Single image upload
  single: (fieldName = 'image', options = {}) => {
    const {
      maxSize = 5 * 1024 * 1024, // 5MB default
      allowedTypes = ['image'],
      storage = 'local'
    } = options;

    return multer({
      storage: storage === 'memory' ? memoryStorage : localStorage,
      limits: { fileSize: maxSize },
      fileFilter: fileFilter(allowedTypes)
    }).single(fieldName);
  },

  // Multiple images upload
  multiple: (fieldName = 'images', options = {}) => {
    const {
      maxCount = 10,
      maxSize = 5 * 1024 * 1024, // 5MB per file
      allowedTypes = ['image'],
      storage = 'local'
    } = options;

    return multer({
      storage: storage === 'memory' ? memoryStorage : localStorage,
      limits: { fileSize: maxSize },
      fileFilter: fileFilter(allowedTypes)
    }).array(fieldName, maxCount);
  },

  // Mixed fields upload
  fields: (fields = [], options = {}) => {
    const {
      maxSize = 5 * 1024 * 1024,
      allowedTypes = ['image'],
      storage = 'local'
    } = options;

    return multer({
      storage: storage === 'memory' ? memoryStorage : localStorage,
      limits: { fileSize: maxSize },
      fileFilter: fileFilter(allowedTypes)
    }).fields(fields);
  }
};

// Cloudinary upload helper
const uploadToCloudinary = async (file, options = {}) => {
  const {
    folder = 'angara',
    transformation = {},
    resourceType = 'auto'
  } = options;

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: resourceType,
      transformation,
      use_filename: true,
      unique_filename: true
    };

    if (file.buffer) {
      // Upload from memory (buffer)
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(file.buffer);
    } else {
      // Upload from file path
      cloudinary.uploader.upload(file.path, uploadOptions)
        .then(resolve)
        .catch(reject);
    }
  });
};

// Middleware to handle Cloudinary uploads
const cloudinaryUpload = (options = {}) => {
  return async (req, res, next) => {
    try {
      if (!req.file && !req.files) {
        return next();
      }

      const {
        folder = 'angara',
        transformation = {},
        deleteLocal = true
      } = options;

      // Handle single file
      if (req.file) {
        const result = await uploadToCloudinary(req.file, {
          folder: `${folder}/${req.baseUrl.split('/').pop()}`,
          transformation
        });

        req.file.cloudinary = result;
        req.file.url = result.secure_url;
        req.file.publicId = result.public_id;

        // Delete local file if requested
        if (deleteLocal && req.file.path) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting local file:', err);
          });
        }
      }

      // Handle multiple files
      if (req.files) {
        if (Array.isArray(req.files)) {
          // Handle array of files
          for (const file of req.files) {
            const result = await uploadToCloudinary(file, {
              folder: `${folder}/${req.baseUrl.split('/').pop()}`,
              transformation
            });

            file.cloudinary = result;
            file.url = result.secure_url;
            file.publicId = result.public_id;

            // Delete local file if requested
            if (deleteLocal && file.path) {
              fs.unlink(file.path, (err) => {
                if (err) console.error('Error deleting local file:', err);
              });
            }
          }
        } else {
          // Handle fields object
          for (const fieldName in req.files) {
            const files = req.files[fieldName];
            for (const file of files) {
              const result = await uploadToCloudinary(file, {
                folder: `${folder}/${fieldName}`,
                transformation
              });

              file.cloudinary = result;
              file.url = result.secure_url;
              file.publicId = result.public_id;

              // Delete local file if requested
              if (deleteLocal && file.path) {
                fs.unlink(file.path, (err) => {
                  if (err) console.error('Error deleting local file:', err);
                });
              }
            }
          }
        }
      }

      next();
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: error.message
      });
    }
  };
};

// Delete file from Cloudinary
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

// Specific upload configurations for different endpoints

// Product image uploads
const productImages = uploadConfigs.multiple('images', {
  maxCount: 8,
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image'],
  storage: 'memory'
});

// User avatar upload
const userAvatar = uploadConfigs.single('avatar', {
  maxSize: 2 * 1024 * 1024, // 2MB
  allowedTypes: ['image'],
  storage: 'memory'
});

// Blog post images
const blogImages = uploadConfigs.fields([
  { name: 'featuredImage', maxCount: 1 },
  { name: 'contentImages', maxCount: 10 }
], {
  maxSize: 5 * 1024 * 1024,
  allowedTypes: ['image'],
  storage: 'memory'
});

// Customer story images
const storyImages = uploadConfigs.multiple('images', {
  maxCount: 5,
  maxSize: 8 * 1024 * 1024, // 8MB
  allowedTypes: ['image'],
  storage: 'memory'
});

// Content management uploads
const contentMedia = uploadConfigs.fields([
  { name: 'image', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'video', maxCount: 1 }
], {
  maxSize: 20 * 1024 * 1024, // 20MB for videos
  allowedTypes: ['image', 'video'],
  storage: 'memory'
});

// Review images
const reviewImages = uploadConfigs.multiple('images', {
  maxCount: 3,
  maxSize: 5 * 1024 * 1024,
  allowedTypes: ['image'],
  storage: 'memory'
});

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field name in file upload';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts in multipart upload';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        break;
    }

    return res.status(400).json({
      success: false,
      message,
      code: error.code
    });
  } else if (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next();
};

// Utility function to get file size in human readable format
const getFileSize = (bytes) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

module.exports = {
  uploadConfigs,
  cloudinaryUpload,
  deleteFromCloudinary,
  productImages,
  userAvatar,
  blogImages,
  storyImages,
  contentMedia,
  reviewImages,
  handleUploadError,
  getFileSize
};