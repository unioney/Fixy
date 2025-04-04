const express = require('express');
const router = express.Router();

const { authenticateJwt } = require('../middleware/auth.middleware');
const { getCurrentUser } = require('../controllers/user.controller');

// GET /api/users/me
router.get('/me', authenticateJwt, getCurrentUser);

module.exports = router;
