const express = require('express');
const { body } = require('express-validator');
const adminController = require('../controllers/admin');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const superAdmin = require('../middleware/superAdmin'); // You'll need to create this

const router = express.Router();

// All routes require authentication and admin role
router.use([auth, admin]);

// Dashboard
router.get('/dashboard', adminController.getDashboardData);

// Customer Management
router.get('/customers', adminController.getAllCustomers);
router.get('/customers/:id', adminController.getCustomerDetails);
router.patch('/customers/:id/status', [
  body('isActive').optional().isBoolean(),
  body('isVerified').optional().isBoolean()
], adminController.updateCustomerStatus);

// Inventory & Alerts
router.get('/inventory-alerts', adminController.getInventoryAlerts);

// Notifications
router.get('/notifications', adminController.getNotifications);
router.patch('/notifications/:id/read', adminController.markNotificationRead);
router.patch('/notifications/mark-all-read', adminController.markAllNotificationsRead);

// Activity Log
router.get('/activity-log', adminController.getActivityLog);

// System Status
router.get('/system-status', adminController.getSystemStatus);

// Data Export
router.get('/export/:type', adminController.exportData);

// Bulk Actions
router.post('/bulk-actions', [
  body('action').notEmpty().withMessage('Action is required'),
  body('type').notEmpty().withMessage('Type is required'),
  body('ids').isArray({ min: 1 }).withMessage('IDs array is required'),
  body('data').optional().isObject()
], adminController.bulkActions);

// Admin User Management (Super Admin only)
router.get('/users', superAdmin, adminController.getAdminUsers);
router.post('/users/create', superAdmin, [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], adminController.createAdminUser);

module.exports = router;