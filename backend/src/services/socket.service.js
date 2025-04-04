const socketIo = require('socket.io');
const db = require('../config/database');
const { authenticateJwt } = require('../middleware/auth.middleware');

// Set up socket handlers
const setupSocketHandlers = (io) => {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      // Get token from handshake auth
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }
      
      // Verify token
      const user = await authenticateSocketToken(token);
      
      if (!user) {
        return next(new Error('Authentication error: Invalid token'));
      }
      
      // Attach user to socket
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });
  
  // Connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}`);
    
    // Join user's rooms
    joinUserRooms(socket);
    
    // Handle joining a specific chatroom
    socket.on('join-chatroom', (chatroomId) => {
      joinChatroom(socket, chatroomId);
    });
    
    // Handle leaving a specific chatroom
    socket.on('leave-chatroom', (chatroomId) => {
      leaveChatroom(socket, chatroomId);
    });
    
    // Handle new message
    socket.on('new-message', (data) => {
      handleNewMessage(socket, data);
    });
    
    // Handle typing indicator
    socket.on('typing', (data) => {
      handleTyping(socket, data);
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });
};

// Authenticate socket token
const authenticateSocketToken = async (token) => {
  try {
    // This would normally use the JWT verification from auth middleware
    // For simplicity, we're implementing a basic version here
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const result = await db.query(
      'SELECT id, email, name FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
};

// Join user's rooms
const joinUserRooms = async (socket) => {
  try {
    const userId = socket.user.id;
    
    // Get all chatrooms user is part of
    const result = await db.query(
      `SELECT chatroom_id
       FROM chatroom_participants
       WHERE user_id = $1`,
      [userId]
    );
    
    // Join each chatroom
    for (const row of result.rows) {
      socket.join(`chatroom:${row.chatroom_id}`);
    }
    
    // Also join user's personal room for direct notifications
    socket.join(`user:${userId}`);
  } catch (error) {
    console.error('Error joining user rooms:', error);
  }
};

// Join a specific chatroom
const joinChatroom = async (socket, chatroomId) => {
  try {
    const userId = socket.user.id;
    
    // Check if user is a participant
    const result = await db.query(
      `SELECT * FROM chatroom_participants
       WHERE chatroom_id = $1 AND user_id = $2`,
      [chatroomId, userId]
    );
    
    if (result.rows.length === 0) {
      socket.emit('error', { message: 'You do not have access to this chatroom' });
      return;
    }
    
    // Join the room
    socket.join(`chatroom:${chatroomId}`);
    
    // Notify other participants
    socket.to(`chatroom:${chatroomId}`).emit('user-joined', {
      chatroomId,
      user: {
        id: socket.user.id,
        name: socket.user.name
      }
    });
  } catch (error) {
    console.error('Error joining chatroom:', error);
    socket.emit('error', { message: 'Failed to join chatroom' });
  }
};

// Leave a specific chatroom
const leaveChatroom = (socket, chatroomId) => {
  try {
    socket.leave(`chatroom:${chatroomId}`);
    
    // Notify other participants
    socket.to(`chatroom:${chatroomId}`).emit('user-left', {
      chatroomId,
      user: {
        id: socket.user.id,
        name: socket.user.name
      }
    });
  } catch (error) {
    console.error('Error leaving chatroom:', error);
  }
};

// Handle new message
const handleNewMessage = async (socket, data) => {
  try {
    const { chatroomId, content, agentId } = data;
    const userId = socket.user.id;
    
    // Check if user is a participant
    const participantCheck = await db.query(
      `SELECT * FROM chatroom_participants
       WHERE chatroom_id = $1 AND user_id = $2`,
      [chatroomId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      socket.emit('error', { message: 'You do not have access to this chatroom' });
      return;
    }
    
    // Create message
    const messageResult = await db.query(
      `INSERT INTO messages (chatroom_id, sender_id, content, is_ai)
       VALUES ($1, $2, $3, false)
       RETURNING id, content, is_ai, created_at`,
      [chatroomId, userId, content]
    );
    
    const message = messageResult.rows[0];
    
    // Get user info
    const userResult = await db.query(
      `SELECT id, name, email, profile_image_url FROM users WHERE id = $1`,
      [userId]
    );
    
    message.sender = userResult.rows[0];
    
    // Broadcast message to all participants
    io.to(`chatroom:${chatroomId}`).emit('new-message', message);
    
    // Update chatroom last activity
    await db.query(
      `UPDATE chatrooms SET updated_at = NOW() WHERE id = $1`,
      [chatroomId]
    );
    
    // If agentId is provided, trigger AI response through the controller
    // This is handled by the message controller, not directly in the socket
    if (agentId) {
      // This is just a notification that an AI response is coming
      io.to(`chatroom:${chatroomId}`).emit('ai-thinking', {
        chatroomId,
        agentId
      });
    }
  } catch (error) {
    console.error('Error handling new message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
};

// Handle typing indicator
const handleTyping = (socket, data) => {
  try {
    const { chatroomId, isTyping } = data;
    
    // Broadcast typing status to other participants
    socket.to(`chatroom:${chatroomId}`).emit('typing', {
      chatroomId,
      user: {
        id: socket.user.id,
        name: socket.user.name
      },
      isTyping
    });
  } catch (error) {
    console.error('Error handling typing indicator:', error);
  }
};

// Broadcast AI response
const broadcastAIResponse = (chatroomId, message) => {
  try {
    io.to(`chatroom:${chatroomId}`).emit('new-message', message);
  } catch (error) {
    console.error('Error broadcasting AI response:', error);
  }
};

module.exports = {
  setupSocketHandlers,
  broadcastAIResponse
};
