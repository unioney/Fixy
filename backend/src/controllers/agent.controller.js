const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all AI models
exports.getModels = async (req, res, next) => {
  try {
    const { userId } = req;
    
    // Get user plan
    const userResult = await db.query(
      'SELECT plan FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userPlan = userResult.rows[0].plan;
    
    // Get BYOK keys if user is on Elite plan
    let byokProviders = [];
    if (userPlan === 'Elite' || userPlan === 'Teams') {
      const byokResult = await db.query(
        'SELECT provider FROM byok WHERE user_id = $1 AND is_active = true',
        [userId]
      );
      byokProviders = byokResult.rows.map(row => row.provider);
    }
    
    // Get all models
    const modelsResult = await db.query(
      'SELECT * FROM ai_models WHERE is_active = true ORDER BY name'
    );
    
    // Add availability flag based on user plan
    const models = modelsResult.rows.map(model => {
      let available = true;
      let reason = null;
      
      if (model.requires_elite && userPlan !== 'Elite' && userPlan !== 'Teams') {
        available = false;
        reason = 'requires_elite_plan';
      } else if (model.requires_elite && (userPlan === 'Elite' || userPlan === 'Teams') && !byokProviders.includes(model.provider)) {
        available = false;
        reason = 'requires_byok';
      }
      
      return {
        ...model,
        available,
        reason
      };
    });
    
    res.status(200).json({ models });
  } catch (error) {
    next(error);
  }
};

// Get agents for a chatroom
exports.getChatroomAgents = async (req, res, next) => {
  try {
    const { userId } = req;
    const { chatroomId } = req.params;
    
    // Check if user is a participant
    const participantCheck = await db.query(
      `SELECT * FROM chatroom_participants 
       WHERE chatroom_id = $1 AND user_id = $2`,
      [chatroomId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You do not have access to this chatroom' });
    }
    
    // Get agents
    const agentsResult = await db.query(
      `SELECT a.id, a.name, a.config, a.created_at,
              am.name as model_name, am.provider, am.model_id, am.credit_cost, am.requires_elite
       FROM agents a
       JOIN ai_models am ON a.model_id = am.id
       WHERE a.chatroom_id = $1 AND a.is_active = true
       ORDER BY a.created_at`,
      [chatroomId]
    );
    
    res.status(200).json({ agents: agentsResult.rows });
  } catch (error) {
    next(error);
  }
};

// Add an agent to a chatroom
exports.addAgent = async (req, res, next) => {
  try {
    const { userId } = req;
    const { chatroomId } = req.params;
    const { name, modelId, config = {} } = req.body;
    
    // Check if user is a participant
    const participantCheck = await db.query(
      `SELECT * FROM chatroom_participants 
       WHERE chatroom_id = $1 AND user_id = $2`,
      [chatroomId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You do not have access to this chatroom' });
    }
    
    // Check if model exists
    const modelResult = await db.query(
      'SELECT * FROM ai_models WHERE id = $1 AND is_active = true',
      [modelId]
    );
    
    if (modelResult.rows.length === 0) {
      return res.status(404).json({ message: 'Model not found' });
    }
    
    const model = modelResult.rows[0];
    
    // Check user plan
    const userResult = await db.query(
      'SELECT plan FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userPlan = userResult.rows[0].plan;
    
    // Check if model is available on user's plan
    if (model.requires_elite && userPlan !== 'Elite' && userPlan !== 'Teams') {
      return res.status(403).json({ 
        message: 'This model requires the Elite plan',
        upgrade_required: true
      });
    }
    
    // If Elite plan, check if user has BYOK for this provider
    if (model.requires_elite && (userPlan === 'Elite' || userPlan === 'Teams')) {
      const byokResult = await db.query(
        'SELECT * FROM byok WHERE user_id = $1 AND provider = $2 AND is_active = true',
        [userId, model.provider]
      );
      
      if (byokResult.rows.length === 0) {
        return res.status(403).json({ 
          message: `You need to add your ${model.provider} API key to use this model`,
          byok_required: true,
          provider: model.provider
        });
      }
    }
    
    // Create agent
    const agentResult = await db.query(
      `INSERT INTO agents (name, model_id, chatroom_id, config)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, config, created_at`,
      [name, modelId, chatroomId, JSON.stringify(config)]
    );
    
    const agent = agentResult.rows[0];
    agent.model_name = model.name;
    agent.provider = model.provider;
    agent.model_id = model.model_id;
    agent.credit_cost = model.credit_cost;
    agent.requires_elite = model.requires_elite;
    
    res.status(201).json({ 
      message: 'Agent added successfully',
      agent
    });
  } catch (error) {
    next(error);
  }
};

// Update an agent
exports.updateAgent = async (req, res, next) => {
  try {
    const { userId } = req;
    const { agentId } = req.params;
    const { name, config } = req.body;
    
    // Check if agent exists and user has access
    const agentResult = await db.query(
      `SELECT a.*, c.owner_id
       FROM agents a
       JOIN chatrooms c ON a.chatroom_id = c.id
       JOIN chatroom_participants cp ON c.id = cp.chatroom_id
       WHERE a.id = $1 AND cp.user_id = $2`,
      [agentId, userId]
    );
    
    if (agentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found or you do not have access' });
    }
    
    // Update agent
    const updateResult = await db.query(
      `UPDATE agents
       SET name = COALESCE($1, name),
           config = COALESCE($2, config),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, config, updated_at`,
      [name, config ? JSON.stringify(config) : null, agentId]
    );
    
    res.status(200).json({ 
      message: 'Agent updated successfully',
      agent: updateResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Remove an agent from a chatroom
exports.removeAgent = async (req, res, next) => {
  try {
    const { userId } = req;
    const { agentId } = req.params;
    
    // Check if agent exists and user has access
    const agentResult = await db.query(
      `SELECT a.*, c.owner_id
       FROM agents a
       JOIN chatrooms c ON a.chatroom_id = c.id
       JOIN chatroom_participants cp ON c.id = cp.chatroom_id
       WHERE a.id = $1 AND cp.user_id = $2`,
      [agentId, userId]
    );
    
    if (agentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found or you do not have access' });
    }
    
    // Soft delete agent
    await db.query(
      `UPDATE agents
       SET is_active = false, updated_at = NOW()
       WHERE id = $1`,
      [agentId]
    );
    
    res.status(200).json({ message: 'Agent removed successfully' });
  } catch (error) {
    next(error);
  }
};
