const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// These routes will be implemented in the user controller
// For now, we'll create placeholder routes

// Get user profile
router.get('/profile', userController.getProfile);

// Update user profile
router.put('/profile', userController.updateProfile);

// Get user subscription
router.get('/subscription', userController.getSubscription);

// Cancel subscription
router.post('/subscription/cancel', userController.cancelSubscription);

module.exports = router;
