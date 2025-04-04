const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const stripe = require('../services/stripe.service');
const { sendEmail } = require('../services/email.service');

// Get all chatrooms for a user
exports.getChatrooms = async (req, res, next) => {
  try {
    const { userId } = req; // ID of the user making the request
    
    const result = await db.query(
      `SELECT c.id, c.title, c.type, c.owner_id, c.created_at, c.updated_at,
              u.name as owner_name, u.email as owner_email
       FROM chatrooms c
       JOIN users u ON c.owner_id = u.id
       JOIN chatroom_participants cp ON c.id = cp.chatroom_id
       WHERE cp.user_id = $1 AND c.is_active = true
       ORDER BY c.updated_at DESC`,
      [userId]
    );
    
    res.status(200).json({ chatrooms: result.rows });
  } catch (error) {
    next(error);
  }
};

// Get a single chatroom with participants and agents
exports.getChatroom = async (req, res, next) => {
  try {
    const { userId } = req; // ID of the user making the request
    const { id } = req.params; // Chatroom ID
    
    // Check if user is a participant
    const participantCheck = await db.query(
      `SELECT * FROM chatroom_participants 
       WHERE chatroom_id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You do not have access to this chatroom' });
    }
    
    // Get chatroom details
    const chatroomResult = await db.query(
      `SELECT c.id, c.title, c.type, c.owner_id, c.created_at, c.updated_at,
              u.name as owner_name, u.email as owner_email
       FROM chatrooms c
       JOIN users u ON c.owner_id = u.id
       WHERE c.id = $1 AND c.is_active = true`,
      [id]
    );
    
    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({ message: 'Chatroom not found' });
    }
    
    const chatroom = chatroomResult.rows[0];
    
    // Get participants
    const participantsResult = await db.query(
      `SELECT u.id, u.name, u.email, u.profile_image_url, cp.joined_at
       FROM chatroom_participants cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.chatroom_id = $1`,
      [id]
    );
    
    chatroom.participants = participantsResult.rows;
    
    // Get agents
    const agentsResult = await db.query(
      `SELECT a.id, a.name, a.config, a.created_at,
              am.name as model_name, am.provider, am.model_id, am.credit_cost, am.requires_elite
       FROM agents a
       JOIN ai_models am ON a.model_id = am.id
       WHERE a.chatroom_id = $1 AND a.is_active = true`,
      [id]
    );
    
    chatroom.agents = agentsResult.rows;
    
    res.status(200).json({ chatroom });
  } catch (error) {
    next(error);
  }
};

// Create a new chatroom
exports.createChatroom = async (req, res, next) => {
  try {
    const { userId } = req; // ID of the user making the request
    const { title, type } = req.body;
    
    // Check user plan for Teams requirement if creating a group chat
    if (type === 'group') {
      const userResult = await db.query(
        'SELECT plan FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const userPlan = userResult.rows[0].plan;
      if (userPlan !== 'Teams') {
        return res.status(403).json({ 
          message: 'Group chatrooms require the Teams plan',
          upgrade_required: true
        });
      }
    }
    
    // Create chatroom
    const chatroomResult = await db.query(
      `INSERT INTO chatrooms (title, type, owner_id)
       VALUES ($1, $2, $3)
       RETURNING id, title, type, owner_id, created_at, updated_at`,
      [title, type, userId]
    );
    
    const chatroom = chatroomResult.rows[0];
    
    // Add owner as participant
    await db.query(
      `INSERT INTO chatroom_participants (chatroom_id, user_id)
       VALUES ($1, $2)`,
      [chatroom.id, userId] // Use the owner's ID
    );
    
    res.status(201).json({ 
      message: 'Chatroom created successfully',
      chatroom 
    });
  } catch (error) {
    next(error);
  }
};

// Update a chatroom
exports.updateChatroom = async (req, res, next) => {
  try {
    const { userId } = req; // ID of the user making the request
    const { id } = req.params; // Chatroom ID
    const { title } = req.body;
    
    // Check if user is the owner
    const chatroomResult = await db.query(
      'SELECT * FROM chatrooms WHERE id = $1',
      [id]
    );
    
    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({ message: 'Chatroom not found' });
    }
    
    if (chatroomResult.rows[0].owner_id !== userId) {
      return res.status(403).json({ message: 'Only the owner can update this chatroom' });
    }
    
    // Update chatroom
    const updateResult = await db.query(
      `UPDATE chatrooms
       SET title = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, title, type, owner_id, created_at, updated_at`,
      [title, id]
    );
    
    res.status(200).json({ 
      message: 'Chatroom updated successfully',
      chatroom: updateResult.rows[0] 
    });
  } catch (error) {
    next(error);
  }
};

// Delete a chatroom
exports.deleteChatroom = async (req, res, next) => {
  try {
    const { userId } = req; // ID of the user making the request
    const { id } = req.params; // Chatroom ID
    
    // Check if user is the owner
    const chatroomResult = await db.query(
      'SELECT * FROM chatrooms WHERE id = $1',
      [id]
    );
    
    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({ message: 'Chatroom not found' });
    }
    
    if (chatroomResult.rows[0].owner_id !== userId) {
      return res.status(403).json({ message: 'Only the owner can delete this chatroom' });
    }
    
    // Soft delete chatroom
    await db.query(
      `UPDATE chatrooms
       SET is_active = false, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    
    res.status(200).json({ message: 'Chatroom deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Add a participant to a chatroom (Teams plan only)
exports.addParticipant = async (req, res, next) => {
  try {
    const { userId } = req; // ID of the user making the request (inviter)
    const { id } = req.params; // Chatroom ID
    const { email } = req.body; // Email of the user to add (invitee)
    
    // Check if user making request is the owner
    const chatroomResult = await db.query(
      'SELECT c.*, u.plan FROM chatrooms c JOIN users u ON c.owner_id = u.id WHERE c.id = $1',
      [id]
    );
    
    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({ message: 'Chatroom not found' });
    }
    
    const chatroom = chatroomResult.rows[0];
    
    if (chatroom.owner_id !== userId) { // Check against inviter's ID
      return res.status(403).json({ message: 'Only the owner can add participants' });
    }
    
    // Check if owner has Teams plan
    if (chatroom.plan !== 'Teams') {
      return res.status(403).json({ 
        message: 'Adding participants requires the Teams plan',
        upgrade_required: true
      });
    }
    
    // Check if the user to be added already exists by email
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    // *** FIX APPLIED BELOW ***
    // REMOVED: let userId; 

    if (userResult.rows.length > 0) {
      // User exists, get their ID
      const participantUserId = userResult.rows[0].id; // Use new variable name for the user being added

      // Check if this user is already a participant in this chatroom
      const participantCheck = await db.query(
        'SELECT * FROM chatroom_participants WHERE chatroom_id = $1 AND user_id = $2',
        [id, participantUserId] // Use the new variable name
      );
      
      if (participantCheck.rows.length > 0) {
        return res.status(400).json({ message: 'User is already a participant' });
      }
      
      // Add existing user as participant
      await db.query(
        'INSERT INTO chatroom_participants (chatroom_id, user_id) VALUES ($1, $2)',
        [id, participantUserId] // Use the new variable name
      );
      
      // Send notification email to the added participant
      await sendEmail({
        to: email,
        subject: `You've been added to a chatroom on Fixy`,
        text: `You've been added to the chatroom "${chatroom.title}" on Fixy. Login to view it.`,
        html: `<h1>You've been added to a chatroom</h1>
               <p>You've been added to the chatroom "${chatroom.title}" on Fixy.</p>
               <p><a href="${process.env.FRONTEND_URL}/login">Login to view it</a></p>`
      });
      
      return res.status(200).json({ message: 'Participant added successfully' });

    } else {
      // User doesn't exist, create an invite
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
      
      await db.query(
        `INSERT INTO team_invites (email, inviter_id, chatroom_id, token, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [email, userId, id, token, expiresAt] // Use original userId (inviter's ID) here
      );
      
      // Send invite email
      const inviteUrl = `${process.env.FRONTEND_URL}/invite?token=${token}`;
      await sendEmail({
        to: email,
        subject: `You've been invited to join Fixy`,
        text: `You've been invited to join the chatroom "${chatroom.title}" on Fixy. Click here to accept: ${inviteUrl}`,
        html: `<h1>You've been invited to join Fixy</h1>
               <p>You've been invited to join the chatroom "${chatroom.title}" on Fixy.</p>
               <p><a href="${inviteUrl}">Click here to accept the invitation</a></p>
               <p>This invitation expires in 7 days.</p>`
      });
      
      res.status(200).json({ message: 'Invitation sent successfully' });
    }
  } catch (error) {
    next(error);
  }
};

// Remove a participant from a chatroom
exports.removeParticipant = async (req, res, next) => {
  try {
    const { userId } = req; // ID of the user making the request
    const { id } = req.params; // Chatroom ID
    const { participantId } = req.body; // ID of the participant to remove
    
    // Check if user is the owner OR if the user is trying to remove themselves
    const chatroomResult = await db.query(
      'SELECT * FROM chatrooms WHERE id = $1',
      [id]
    );
    
    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({ message: 'Chatroom not found' });
    }
    
    const isOwner = chatroomResult.rows[0].owner_id === userId;
    const isRemovingSelf = participantId === userId;

    if (!isOwner && !isRemovingSelf) { // Allow removal only if owner OR if removing self
         return res.status(403).json({ message: 'You do not have permission to remove this participant' });
    }

    // Owner cannot be removed (implicitly handled by logic above, but explicit check is clearer)
    if (participantId === chatroomResult.rows[0].owner_id && !isRemovingSelf) {
       // This condition should ideally not be met if the above logic is correct, 
       // but added for robustness. A user cannot remove the owner unless they ARE the owner removing someone else.
       // If the owner tries to remove themselves via this endpoint, the !isRemovingSelf prevents it.
       // Separate "leave chatroom" or "delete chatroom" logic should handle the owner leaving/deleting.
        return res.status(400).json({ message: 'The owner cannot be removed via this action.' });
    }
    
    // Remove participant
    const deleteResult = await db.query(
      'DELETE FROM chatroom_participants WHERE chatroom_id = $1 AND user_id = $2 RETURNING *',
      [id, participantId]
    );

    if (deleteResult.rowCount === 0) {
         return res.status(404).json({ message: 'Participant not found in this chatroom.' });
    }
    
    res.status(200).json({ message: 'Participant removed successfully' });
  } catch (error) {
    next(error);
  }
};