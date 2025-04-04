const express = require('express');
const router = express.Router();

const { authenticateJwt } = require('../middleware/auth.middleware');
const {
  getCurrentUser,
  getProfile,
  updateProfile,
  getSubscription,
  cancelSubscription
} = require('../controllers/user.controller');

// Authenticated route to get current user
router.get('/me', authenticateJwt, getCurrentUser);

// User profile routes
router.get('/profile', authenticateJwt, getProfile);
router.put('/profile', authenticateJwt, updateProfile);

// Subscription routes
router.get('/subscription', authenticateJwt, getSubscription);
router.post('/subscription/cancel', authenticateJwt, cancelSubscription);

module.exports = router;
