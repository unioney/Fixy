const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');

// Get messages for a chatroom
router.get('/:id', messageController.getMessages);

// Send a message
router.post('/:id', messageController.sendMessage);

module.exports = router;
