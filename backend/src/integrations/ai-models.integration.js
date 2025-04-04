const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/database');

// AI model providers
const PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google'
};

// AI models configuration
const MODELS = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: PROVIDERS.OPENAI,
    credit_cost: 2,
    requires_elite_plan: false,
    requires_byok: false
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: PROVIDERS.OPENAI,
    credit_cost: 1,
    requires_elite_plan: false,
    requires_byok: false
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: PROVIDERS.OPENAI,
    credit_cost: 0.2,
    requires_elite_plan: false,
    requires_byok: false
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: PROVIDERS.ANTHROPIC,
    credit_cost: 3,
    requires_elite_plan: true,
    requires_byok: true
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: PROVIDERS.ANTHROPIC,
    credit_cost: 1.5,
    requires_elite_plan: true,
    requires_byok: true
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: PROVIDERS.ANTHROPIC,
    credit_cost: 0.5,
    requires_elite_plan: false,
    requires_byok: true
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: PROVIDERS.GOOGLE,
    credit_cost: 0.5,
    requires_elite_plan: false,
    requires_byok: true
  },
  {
    id: 'gemini-ultra',
    name: 'Gemini Ultra',
    provider: PROVIDERS.GOOGLE,
    credit_cost: 2,
    requires_elite_plan: true,
    requires_byok: true
  }
];

// Get API key for a provider
const getApiKey = async (userId, provider) => {
  try {
    // Check if user has BYOK for this provider
    const byokResult = await db.query(
      'SELECT encrypted_api_key FROM byok WHERE user_id = $1 AND provider = $2',
      [userId, provider]
    );
    
    if (byokResult.rows.length > 0) {
      // Decrypt API key
      const encryptedKey = byokResult.rows[0].encrypted_api_key;
      const decryptedKey = decryptApiKey(encryptedKey);
      return decryptedKey;
    }
    
    // If no BYOK, use platform API key
    switch (provider) {
      case PROVIDERS.OPENAI:
        return process.env.OPENAI_API_KEY;
      case PROVIDERS.ANTHROPIC:
        return process.env.ANTHROPIC_API_KEY;
      case PROVIDERS.GOOGLE:
        return process.env.GOOGLE_AI_API_KEY;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    console.error(`Error getting API key for ${provider}:`, error);
    throw error;
  }
};

// Encrypt API key
const encryptApiKey = (apiKey) => {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
};

// Decrypt API key
const decryptApiKey = (encryptedKey) => {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  
  const parts = encryptedKey.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Get available models for a user
const getAvailableModels = async (userId) => {
  try {
    // Get user's plan
    const userResult = await db.query(
      'SELECT plan FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const userPlan = userResult.rows[0].plan;
    const isEliteOrTeams = userPlan === 'Elite' || userPlan === 'Teams';
    
    // Get user's BYOK providers
    const byokResult = await db.query(
      'SELECT provider FROM byok WHERE user_id = $1',
      [userId]
    );
    
    const userByokProviders = byokResult.rows.map(row => row.provider);
    
    // Filter models based on user's plan and BYOK
    return MODELS.map(model => {
      const available = 
        (!model.requires_elite_plan || isEliteOrTeams) && 
        (!model.requires_byok || userByokProviders.includes(model.provider));
      
      return {
        ...model,
        available,
        reason: !available 
          ? (model.requires_elite_plan && !isEliteOrTeams 
              ? 'requires_elite_plan' 
              : model.requires_byok && !userByokProviders.includes(model.provider)
                ? 'requires_byok'
                : null)
          : null
      };
    });
  } catch (error) {
    console.error('Error getting available models:', error);
    throw error;
  }
};

// Generate AI response
const generateAiResponse = async (userId, modelId, messages) => {
  try {
    // Get model details
    const model = MODELS.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }
    
    // Get API key
    const apiKey = await getApiKey(userId, model.provider);
    if (!apiKey) {
      throw new Error(`No API key available for ${model.provider}`);
    }
    
    // Generate response based on provider
    let response;
    switch (model.provider) {
      case PROVIDERS.OPENAI:
        response = await generateOpenAiResponse(apiKey, model.id, messages);
        break;
      case PROVIDERS.ANTHROPIC:
        response = await generateAnthropicResponse(apiKey, model.id, messages);
        break;
      case PROVIDERS.GOOGLE:
        response = await generateGoogleResponse(apiKey, model.id, messages);
        break;
      default:
        throw new Error(`Unsupported provider: ${model.provider}`);
    }
    
    // Calculate credits used
    const creditsUsed = model.credit_cost;
    
    // Update user's credit usage
    await db.query(
      'UPDATE credits SET used_credits = used_credits + $1 WHERE user_id = $2',
      [creditsUsed, userId]
    );
    
    // Record credit transaction
    await db.query(
      'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
      [userId, -creditsUsed, 'usage', `Used ${model.name} AI model`]
    );
    
    return {
      content: response,
      creditsUsed
    };
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw error;
  }
};

// Generate response using OpenAI API
const generateOpenAiResponse = async (apiKey, modelId, messages) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: modelId,
        messages: messages.map(msg => ({
          role: msg.role || (msg.isUser ? 'user' : 'assistant'),
          content: msg.content
        })),
        temperature: 0.7
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

// Generate response using Anthropic API
const generateAnthropicResponse = async (apiKey, modelId, messages) => {
  try {
    // Convert messages to Anthropic format
    const formattedMessages = [];
    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role || (msg.isUser ? 'user' : 'assistant'),
        content: msg.content
      });
    }
    
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: modelId,
        messages: formattedMessages,
        max_tokens: 1024
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

// Generate response using Google AI API
const generateGoogleResponse = async (apiKey, modelId, messages) => {
  try {
    // Convert messages to Google format
    const formattedMessages = messages.map(msg => ({
      role: msg.role || (msg.isUser ? 'user' : 'model'),
      parts: [{ text: msg.content }]
    }));
    
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
      {
        contents: formattedMessages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        params: {
          key: apiKey
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
  MODELS,
  PROVIDERS,
  getAvailableModels,
  generateAiResponse,
  encryptApiKey,
  decryptApiKey
};
