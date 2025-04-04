const db = require('../config/database');
const { getAIResponse } = require('../services/ai.service');

// Get messages for a chatroom
exports.getMessages = async (req, res, next) => {
  try {
    const { userId } = req;
    const { id } = req.params;
    const { limit = 50, before } = req.query;
    
    // Check if user is a participant
    const participantCheck = await db.query(
      `SELECT * FROM chatroom_participants 
       WHERE chatroom_id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You do not have access to this chatroom' });
    }
    
    // Build query
    let query = `
      SELECT m.id, m.content, m.is_ai, m.created_at, m.credits_used,
             CASE 
               WHEN m.sender_id IS NOT NULL THEN json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'profile_image_url', u.profile_image_url)
               ELSE NULL
             END as sender,
             CASE 
               WHEN m.agent_id IS NOT NULL THEN json_build_object('id', a.id, 'name', a.name, 'model', am.name, 'provider', am.provider)
               ELSE NULL
             END as agent
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN agents a ON m.agent_id = a.id
      LEFT JOIN ai_models am ON a.model_id = am.id
      WHERE m.chatroom_id = $1
    `;
    
    const queryParams = [id];
    let paramIndex = 2;
    
    if (before) {
      query += ` AND m.created_at < $${paramIndex}`;
      queryParams.push(before);
      paramIndex++;
    }
    
    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex}`;
    queryParams.push(limit);
    
    const result = await db.query(query, queryParams);
    
    // Return messages in chronological order
    const messages = result.rows.reverse();
    
    res.status(200).json({ messages });
  } catch (error) {
    next(error);
  }
};

// Send a message
exports.sendMessage = async (req, res, next) => {
  try {
    const { userId } = req;
    const { id } = req.params;
    const { content, agentId } = req.body;
    
    // Check if user is a participant
    const participantCheck = await db.query(
      `SELECT * FROM chatroom_participants 
       WHERE chatroom_id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You do not have access to this chatroom' });
    }
    
    // Create message
    const messageResult = await db.query(
      `INSERT INTO messages (chatroom_id, sender_id, content, is_ai)
       VALUES ($1, $2, $3, false)
       RETURNING id, content, is_ai, created_at`,
      [id, userId, content]
    );
    
    const message = messageResult.rows[0];
    
    // Get user info
    const userResult = await db.query(
      `SELECT id, name, email, profile_image_url FROM users WHERE id = $1`,
      [userId]
    );
    
    message.sender = userResult.rows[0];
    
    // If agentId is provided, trigger AI response
    if (agentId) {
      // Check if agent exists and is in this chatroom
      const agentResult = await db.query(
        `SELECT a.id, a.name, a.config, am.id as model_id, am.name as model_name, 
                am.provider, am.model_id as provider_model_id, am.credit_cost, am.requires_elite
         FROM agents a
         JOIN ai_models am ON a.model_id = am.id
         WHERE a.id = $1 AND a.chatroom_id = $2 AND a.is_active = true`,
        [agentId, id]
      );
      
      if (agentResult.rows.length === 0) {
        return res.status(404).json({ message: 'Agent not found in this chatroom' });
      }
      
      const agent = agentResult.rows[0];
      
      // Check user plan and credits
      const userPlanResult = await db.query(
        `SELECT u.plan, c.used, c.limit_amount
         FROM users u
         JOIN credits c ON u.id = c.user_id
         WHERE u.id = $1`,
        [userId]
      );
      
      if (userPlanResult.rows.length === 0) {
        return res.status(404).json({ message: 'User credits not found' });
      }
      
      const { plan, used, limit_amount } = userPlanResult.rows[0];
      
      // Check if model is available on user's plan
      if (agent.requires_elite && plan !== 'Elite' && plan !== 'Teams') {
        return res.status(403).json({ 
          message: 'This model requires the Elite plan',
          upgrade_required: true
        });
      }
      
      // Check if user has enough credits (not needed for Elite plan with BYOK)
      const needsCredits = plan !== 'Elite' || !await hasValidByokKey(userId, agent.provider);
      
      if (needsCredits && used >= limit_amount) {
        return res.status(403).json({ 
          message: 'You have reached your credit limit',
          upgrade_required: true
        });
      }
      
      // Trigger AI response asynchronously
      // In a real implementation, this would be handled by a queue/worker system
      // For simplicity, we're doing it in the request handler
      getAIResponse(id, userId, agent, message)
        .then(async (aiResponse) => {
          // This happens asynchronously after the HTTP response is sent
          console.log(`AI response generated for message ${message.id}`);
        })
        .catch(error => {
          console.error('Error generating AI response:', error);
        });
    }
    
    // Update chatroom last activity
    await db.query(
      `UPDATE chatrooms SET updated_at = NOW() WHERE id = $1`,
      [id]
    );
    
    res.status(201).json({ 
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to check if user has valid BYOK key
async function hasValidByokKey(userId, provider) {
  const result = await db.query(
    `SELECT * FROM byok WHERE user_id = $1 AND provider = $2 AND is_active = true`,
    [userId, provider]
  );
  
  return result.rows.length > 0;
}
