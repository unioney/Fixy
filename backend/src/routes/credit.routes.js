const express = require('express');
const router = express.Router();
const creditController = require('../controllers/credit.controller');

// Get user credits
router.get('/', creditController.getCredits);

// Top up credits
router.post('/topup', creditController.topUpCredits);

module.exports = router;
