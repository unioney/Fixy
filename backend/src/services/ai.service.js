const axios = require('axios');
const db = require('../config/database');
const { getKeyForProvider } = require('../controllers/byok.controller');
const { processCredits } = require('../controllers/credit.controller');

// Get AI response
const getAIResponse = async (chatroomId, userId, agent, triggerMessage) => {
  try {
    // Get recent messages for context
    const messagesResult = await db.query(
      `SELECT m.id, m.content, m.is_ai, m.created_at,
              CASE 
                WHEN m.sender_id IS NOT NULL THEN json_build_object('id', u.id, 'name', u.name, 'email', u.email)
                ELSE NULL
              END as sender,
              CASE 
                WHEN m.agent_id IS NOT NULL THEN json_build_object('id', a.id, 'name', a.name)
                ELSE NULL
              END as agent
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN agents a ON m.agent_id = a.id
       WHERE m.chatroom_id = $1
       ORDER BY m.created_at DESC
       LIMIT 20`,
      [chatroomId]
    );
    
    // Format messages for AI context
    const context = messagesResult.rows
      .reverse()
      .map(msg => {
        if (msg.is_ai) {
          return {
            role: 'assistant',
            name: msg.agent?.name,
            content: msg.content
          };
        } else {
          return {
            role: 'user',
            name: msg.sender?.name,
            content: msg.content
          };
        }
      });
    
    // Get user plan and check if BYOK is needed
    const userResult = await db.query(
      'SELECT plan FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const userPlan = userResult.rows[0].plan;
    const useByok = userPlan === 'Elite' || (userPlan === 'Teams' && agent.requires_elite);
    
    // Get API key if using BYOK
    let apiKey = null;
    if (useByok) {
      apiKey = await getKeyForProvider(userId, agent.provider);
      if (!apiKey) {
        throw new Error(`No API key found for ${agent.provider}`);
      }
    } else {
      // Use platform API key from environment variables
      switch (agent.provider) {
        case 'OpenAI':
          apiKey = process.env.OPENAI_API_KEY;
          break;
        case 'Anthropic':
          apiKey = process.env.ANTHROPIC_API_KEY;
          break;
        case 'Google':
          apiKey = process.env.GOOGLE_AI_API_KEY;
          break;
        default:
          throw new Error(`Unsupported provider: ${agent.provider}`);
      }
    }
    
    // Generate AI response based on provider
    let aiResponse;
    
    switch (agent.provider) {
      case 'OpenAI':
        aiResponse = await getOpenAIResponse(agent, context, apiKey);
        break;
      case 'Anthropic':
        aiResponse = await getAnthropicResponse(agent, context, apiKey);
        break;
      case 'Google':
        aiResponse = await getGoogleResponse(agent, context, apiKey);
        break;
      default:
        throw new Error(`Unsupported provider: ${agent.provider}`);
    }
    
    // Save AI response to database
    const messageResult = await db.query(
      `INSERT INTO messages (chatroom_id, agent_id, content, is_ai, credits_used)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id, content, is_ai, created_at`,
      [chatroomId, agent.id, aiResponse, agent.credit_cost]
    );
    
    // Process credit usage if not using BYOK
    if (!useByok) {
      await processCredits(
        userId, 
        agent.credit_cost, 
        `AI response from ${agent.name} (${agent.model_name})`
      );
    }
    
    // Update chatroom last activity
    await db.query(
      `UPDATE chatrooms SET updated_at = NOW() WHERE id = $1`,
      [chatroomId]
    );
    
    return messageResult.rows[0];
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw error;
  }
};

// Get response from OpenAI
const getOpenAIResponse = async (agent, context, apiKey) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: agent.provider_model_id,
        messages: [
          { role: 'system', content: agent.config.systemPrompt || `You are ${agent.name}, an AI assistant.` },
          ...context
        ],
        temperature: agent.config.temperature || 0.7,
        max_tokens: agent.config.maxTokens || 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    throw new Error(`OpenAI API error: ${error.response?.data?.error?.message || error.message}`);
  }
};

// Get response from Anthropic
const getAnthropicResponse = async (agent, context, apiKey) => {
  try {
    // Convert context to Anthropic format
    const messages = context.map(msg => {
      return {
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      };
    });
    
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: agent.provider_model_id,
        system: agent.config.systemPrompt || `You are ${agent.name}, an AI assistant.`,
        messages: messages,
        max_tokens: agent.config.maxTokens || 1000,
        temperature: agent.config.temperature || 0.7
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.content[0].text;
  } catch (error) {
    console.error('Anthropic API error:', error.response?.data || error.message);
    throw new Error(`Anthropic API error: ${error.response?.data?.error?.message || error.message}`);
  }
};

// Get response from Google
const getGoogleResponse = async (agent, context, apiKey) => {
  try {
    // Convert context to Google format
    const messages = context.map(msg => {
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      };
    });
    
    // Add system prompt if provided
    if (agent.config.systemPrompt) {
      messages.unshift({
        role: 'system',
        parts: [{ text: agent.config.systemPrompt }]
      });
    }
    
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${agent.provider_model_id}:generateContent?key=${apiKey}`,
      {
        contents: messages,
        generationConfig: {
          temperature: agent.config.temperature || 0.7,
          maxOutputTokens: agent.config.maxTokens || 1000
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Google AI API error:', error.response?.data || error.message);
    throw new Error(`Google AI API error: ${error.response?.data?.error?.message || error.message}`);
  }
};

module.exports = {
  getAIResponse
};
