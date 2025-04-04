const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const stripe = require('../services/stripe.service');
const { sendEmail } = require('../services/email.service');

// Get all chatrooms for a user
exports.getChatrooms = async (req, res, next) => {
  try {
    const { userId } = req;
    
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
    const { userId } = req;
    const { id } = req.params;
    
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
    const { userId } = req;
    const { title, type } = req.body;
    
    // Check user plan for Teams requirement if adding other participants
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
      [chatroom.id, userId]
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
    const { userId } = req;
    const { id } = req.params;
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
    const { userId } = req;
    const { id } = req.params;
    
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
    const { userId } = req;
    const { id } = req.params;
    const { email } = req.body;
    
    // Check if user is the owner
    const chatroomResult = await db.query(
      'SELECT c.*, u.plan FROM chatrooms c JOIN users u ON c.owner_id = u.id WHERE c.id = $1',
      [id]
    );
    
    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({ message: 'Chatroom not found' });
    }
    
    const chatroom = chatroomResult.rows[0];
    
    if (chatroom.owner_id !== userId) {
      return res.status(403).json({ message: 'Only the owner can add participants' });
    }
    
    // Check if owner has Teams plan
    if (chatroom.plan !== 'Teams') {
      return res.status(403).json({ 
        message: 'Adding participants requires the Teams plan',
        upgrade_required: true
      });
    }
    
    // Check if user already exists
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    let foundUserId; // renamed variable to avoid conflict with req.userId

    if (userResult.rows.length > 0) {
      foundUserId = userResult.rows[0].id;
      
      // Check if already a participant
      const participantCheck = await db.query(
        'SELECT * FROM chatroom_participants WHERE chatroom_id = $1 AND user_id = $2',
        [id, foundUserId]
      );
      
      if (participantCheck.rows.length > 0) {
        return res.status(400).json({ message: 'User is already a participant' });
      }
      
      // Add as participant
      await db.query(
        'INSERT INTO chatroom_participants (chatroom_id, user_id) VALUES ($1, $2)',
        [id, foundUserId]
      );
      
      // Send notification email
      await sendEmail({
        to: email,
        subject: `You've been added to a chatroom on Fixy`,
        text: `You've been added to the chatroom "${chatroom.title}" on Fixy. Login to view it.`,
        html: `<h1>You've been added to a chatroom</h1>
               <p>You've been added to the chatroom "${chatroom.title}" on Fixy.</p>
               <p><a href="${process.env.FRONTEND_URL}/login">Login to view it</a></p>`
      });
      
      return res.status(200).json({ message: 'Participant added successfully' });
    }
    
    // User doesn't exist, create invite
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
    
    await db.query(
      `INSERT INTO team_invites (email, inviter_id, chatroom_id, token, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, userId, id, token, expiresAt]
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
  } catch (error) {
    next(error);
  }
};

// Remove a participant from a chatroom
exports.removeParticipant = async (req, res, next) => {
  try {
    const { userId } = req;
    const { id } = req.params;
    const { participantId } = req.body;
    
    // Check if user is the owner
    const chatroomResult = await db.query(
      'SELECT * FROM chatrooms WHERE id = $1',
      [id]
    );
    
    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({ message: 'Chatroom not found' });
    }
    
    if (chatroomResult.rows[0].owner_id !== userId && participantId !== userId) {
      return res.status(403).json({ message: 'Only the owner can remove other participants' });
    }
    
    // Cannot remove the owner
    if (participantId === chatroomResult.rows[0].owner_id) {
      return res.status(400).json({ message: 'Cannot remove the owner from the chatroom' });
    }
    
    // Remove participant
    await db.query(
      'DELETE FROM chatroom_participants WHERE chatroom_id = $1 AND user_id = $2',
      [id, participantId]
    );
    
    res.status(200).json({ message: 'Participant removed successfully' });
  } catch (error) {
    next(error);
  }
};
