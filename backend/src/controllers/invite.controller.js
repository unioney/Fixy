const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('../services/email.service');

// Accept an invitation
exports.acceptInvite = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    // Check if token is valid
    const inviteResult = await db.query(
      `SELECT i.*, c.title as chatroom_title, u.name as inviter_name
       FROM team_invites i
       JOIN chatrooms c ON i.chatroom_id = c.id
       JOIN users u ON i.inviter_id = u.id
       WHERE i.token = $1 AND i.expires_at > NOW() AND i.accepted = false`,
      [token]
    );
    
    if (inviteResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired invitation' });
    }
    
    const invite = inviteResult.rows[0];
    
    // Check if user is logged in
    const { userId } = req;
    
    // Get user email
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userEmail = userResult.rows[0].email;
    
    // Check if the invitation was for this user
    if (userEmail.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({ 
        message: 'This invitation was sent to a different email address',
        invited_email: invite.email
      });
    }
    
    // Add user to chatroom
    await db.query(
      `INSERT INTO chatroom_participants (chatroom_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (chatroom_id, user_id) DO NOTHING`,
      [invite.chatroom_id, userId]
    );
    
    // Mark invitation as accepted
    await db.query(
      `UPDATE team_invites
       SET accepted = true
       WHERE id = $1`,
      [invite.id]
    );
    
    // Send notification to inviter
    await sendEmail({
      to: invite.inviter_email,
      subject: `Fixy: ${userEmail} accepted your invitation`,
      text: `${userEmail} has accepted your invitation to join the chatroom "${invite.chatroom_title}".`,
      html: `<h1>Invitation Accepted</h1>
             <p>${userEmail} has accepted your invitation to join the chatroom "${invite.chatroom_title}".</p>
             <p><a href="${process.env.FRONTEND_URL}/chatroom/${invite.chatroom_id}">Go to chatroom</a></p>`
    });
    
    res.status(200).json({ 
      message: 'Invitation accepted successfully',
      chatroom: {
        id: invite.chatroom_id,
        title: invite.chatroom_title
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get pending invitations for a user
exports.getPendingInvites = async (req, res, next) => {
  try {
    const { userId } = req;
    
    // Get user email
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userEmail = userResult.rows[0].email;
    
    // Get pending invitations
    const invitesResult = await db.query(
      `SELECT i.id, i.token, i.created_at, i.expires_at,
              c.id as chatroom_id, c.title as chatroom_title,
              u.name as inviter_name, u.email as inviter_email
       FROM team_invites i
       JOIN chatrooms c ON i.chatroom_id = c.id
       JOIN users u ON i.inviter_id = u.id
       WHERE i.email = $1 AND i.expires_at > NOW() AND i.accepted = false`,
      [userEmail]
    );
    
    res.status(200).json({ invites: invitesResult.rows });
  } catch (error) {
    next(error);
  }
};

// Resend an invitation
exports.resendInvite = async (req, res, next) => {
  try {
    const { userId } = req;
    const { inviteId } = req.params;
    
    // Check if invitation exists and user is the inviter
    const inviteResult = await db.query(
      `SELECT i.*, c.title as chatroom_title
       FROM team_invites i
       JOIN chatrooms c ON i.chatroom_id = c.id
       WHERE i.id = $1 AND i.inviter_id = $2 AND i.accepted = false`,
      [inviteId, userId]
    );
    
    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Invitation not found or you are not the inviter' });
    }
    
    const invite = inviteResult.rows[0];
    
    // Check if invitation is expired
    if (new Date(invite.expires_at) < new Date()) {
      // Generate new token and extend expiry
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
      
      await db.query(
        `UPDATE team_invites
         SET token = $1, expires_at = $2
         WHERE id = $3`,
        [token, expiresAt, inviteId]
      );
      
      invite.token = token;
      invite.expires_at = expiresAt;
    }
    
    // Send invite email
    const inviteUrl = `${process.env.FRONTEND_URL}/invite?token=${invite.token}`;
    await sendEmail({
      to: invite.email,
      subject: `You've been invited to join Fixy`,
      text: `You've been invited to join the chatroom "${invite.chatroom_title}" on Fixy. Click here to accept: ${inviteUrl}`,
      html: `<h1>You've been invited to join Fixy</h1>
             <p>You've been invited to join the chatroom "${invite.chatroom_title}" on Fixy.</p>
             <p><a href="${inviteUrl}">Click here to accept the invitation</a></p>
             <p>This invitation expires in 7 days.</p>`
    });
    
    res.status(200).json({ message: 'Invitation resent successfully' });
  } catch (error) {
    next(error);
  }
};

// Cancel an invitation
exports.cancelInvite = async (req, res, next) => {
  try {
    const { userId } = req;
    const { inviteId } = req.params;
    
    // Check if invitation exists and user is the inviter
    const inviteResult = await db.query(
      `SELECT * FROM team_invites
       WHERE id = $1 AND inviter_id = $2 AND accepted = false`,
      [inviteId, userId]
    );
    
    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Invitation not found or you are not the inviter' });
    }
    
    // Delete invitation
    await db.query(
      'DELETE FROM team_invites WHERE id = $1',
      [inviteId]
    );
    
    res.status(200).json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    next(error);
  }
};
