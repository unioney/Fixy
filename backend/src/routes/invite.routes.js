const express = require('express');
const router = express.Router();
const inviteController = require('../controllers/invite.controller');

// Accept an invitation
router.post('/accept', inviteController.acceptInvite);

// Get pending invitations for a user
router.get('/pending', inviteController.getPendingInvites);

// Resend an invitation
router.post('/:inviteId/resend', inviteController.resendInvite);

// Cancel an invitation
router.delete('/:inviteId', inviteController.cancelInvite);

module.exports = router;
