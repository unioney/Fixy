const express = require('express');
const router = express.Router();
const byokController = require('../controllers/byok.controller');

// Get user BYOK keys (only providers, not actual keys)
router.get('/', byokController.getKeys);

// Add a new BYOK key
router.post('/', byokController.addKey);

// Delete a BYOK key
router.delete('/:provider', byokController.deleteKey);

module.exports = router;
