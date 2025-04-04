const db = require('../config/database');
const CryptoJS = require('crypto-js');

// Get user BYOK keys (only providers, not actual keys)
exports.getKeys = async (req, res, next) => {
  try {
    const { userId } = req;
    
    // Check if user is on Elite or Teams plan
    const userResult = await db.query(
      'SELECT plan FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userPlan = userResult.rows[0].plan;
    
    if (userPlan !== 'Elite' && userPlan !== 'Teams') {
      return res.status(403).json({ 
        message: 'BYOK is only available for Elite and Teams plans',
        upgrade_required: true
      });
    }
    
    // Get keys (only provider info, not the actual keys)
    const keysResult = await db.query(
      `SELECT id, provider, created_at, updated_at
       FROM byok
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    
    res.status(200).json({ keys: keysResult.rows });
  } catch (error) {
    next(error);
  }
};

// Add a new BYOK key
exports.addKey = async (req, res, next) => {
  try {
    const { userId } = req;
    const { provider, apiKey } = req.body;
    
    // Validate provider
    if (!['OpenAI', 'Anthropic', 'Google'].includes(provider)) {
      return res.status(400).json({ message: 'Invalid provider. Must be OpenAI, Anthropic, or Google.' });
    }
    
    // Check if user is on Elite or Teams plan
    const userResult = await db.query(
      'SELECT plan FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userPlan = userResult.rows[0].plan;
    
    if (userPlan !== 'Elite' && userPlan !== 'Teams') {
      return res.status(403).json({ 
        message: 'BYOK is only available for Elite and Teams plans',
        upgrade_required: true
      });
    }
    
    // Check if key for this provider already exists
    const existingKeyResult = await db.query(
      `SELECT id FROM byok
       WHERE user_id = $1 AND provider = $2 AND is_active = true`,
      [userId, provider]
    );
    
    // Encrypt the API key
    const encryptedKey = CryptoJS.AES.encrypt(
      apiKey,
      process.env.ENCRYPTION_KEY
    ).toString();
    
    if (existingKeyResult.rows.length > 0) {
      // Update existing key
      await db.query(
        `UPDATE byok
         SET api_key_encrypted = $1, updated_at = NOW()
         WHERE id = $2`,
        [encryptedKey, existingKeyResult.rows[0].id]
      );
      
      res.status(200).json({ 
        message: `${provider} API key updated successfully`,
        provider
      });
    } else {
      // Add new key
      await db.query(
        `INSERT INTO byok (user_id, provider, api_key_encrypted)
         VALUES ($1, $2, $3)`,
        [userId, provider, encryptedKey]
      );
      
      res.status(201).json({ 
        message: `${provider} API key added successfully`,
        provider
      });
    }
  } catch (error) {
    next(error);
  }
};

// Delete a BYOK key
exports.deleteKey = async (req, res, next) => {
  try {
    const { userId } = req;
    const { provider } = req.params;
    
    // Validate provider
    if (!['OpenAI', 'Anthropic', 'Google'].includes(provider)) {
      return res.status(400).json({ message: 'Invalid provider. Must be OpenAI, Anthropic, or Google.' });
    }
    
    // Check if key exists
    const keyResult = await db.query(
      `SELECT id FROM byok
       WHERE user_id = $1 AND provider = $2 AND is_active = true`,
      [userId, provider]
    );
    
    if (keyResult.rows.length === 0) {
      return res.status(404).json({ message: `No ${provider} API key found` });
    }
    
    // Soft delete the key
    await db.query(
      `UPDATE byok
       SET is_active = false, updated_at = NOW()
       WHERE id = $1`,
      [keyResult.rows[0].id]
    );
    
    res.status(200).json({ 
      message: `${provider} API key removed successfully`,
      provider
    });
  } catch (error) {
    next(error);
  }
};

// Get a BYOK key (internal function, not exposed as API)
exports.getKeyForProvider = async (userId, provider) => {
  try {
    const result = await db.query(
      `SELECT api_key_encrypted
       FROM byok
       WHERE user_id = $1 AND provider = $2 AND is_active = true`,
      [userId, provider]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Decrypt the API key
    const decryptedKey = CryptoJS.AES.decrypt(
      result.rows[0].api_key_encrypted,
      process.env.ENCRYPTION_KEY
    ).toString(CryptoJS.enc.Utf8);
    
    return decryptedKey;
  } catch (error) {
    console.error('Error getting BYOK key:', error);
    return null;
  }
};
