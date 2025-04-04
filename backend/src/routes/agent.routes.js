const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');

// Get all AI models
router.get('/models', agentController.getModels);

// Get agents for a chatroom
router.get('/chatroom/:chatroomId', agentController.getChatroomAgents);

// Add an agent to a chatroom
router.post('/chatroom/:chatroomId', agentController.addAgent);

// Update an agent
router.put('/:agentId', agentController.updateAgent);

// Remove an agent from a chatroom
router.delete('/:agentId', agentController.removeAgent);

module.exports = router;
