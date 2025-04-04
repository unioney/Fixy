const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateJwt } = require('../middleware/auth.middleware');
const passport = require('passport');

// Register new user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', authController.googleCallback);

// Password reset
router.post('/request-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

// Start trial (requires $1 payment)
router.post('/start-trial', authenticateJwt, authController.startTrial);

// Get current user
router.get('/me', authenticateJwt, authController.getCurrentUser);

// Update profile
router.put('/profile', authenticateJwt, authController.updateProfile);

module.exports = router;
