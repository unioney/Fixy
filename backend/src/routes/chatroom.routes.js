const express = require('express');
const router = express.Router();
const chatroomController = require('../controllers/chatroom.controller');

// Get all chatrooms for a user
router.get('/', chatroomController.getChatrooms);

// Get a single chatroom with participants and agents
router.get('/:id', chatroomController.getChatroom);

// Create a new chatroom
router.post('/', chatroomController.createChatroom);

// Update a chatroom
router.put('/:id', chatroomController.updateChatroom);

// Delete a chatroom
router.delete('/:id', chatroomController.deleteChatroom);

// Add a participant to a chatroom (Teams plan only)
router.post('/:id/participants', chatroomController.addParticipant);

// Remove a participant from a chatroom
router.delete('/:id/participants', chatroomController.removeParticipant);

module.exports = router;
