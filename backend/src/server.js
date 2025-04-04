const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const chatroomRoutes = require('./routes/chatroom.routes');
const messageRoutes = require('./routes/message.routes');
const agentRoutes = require('./routes/agent.routes');
const creditRoutes = require('./routes/credit.routes');
const stripeRoutes = require('./routes/stripe.routes');
const byokRoutes = require('./routes/byok.routes');
const inviteRoutes = require('./routes/invite.routes');

// Import middleware
const { errorHandler } = require('./middleware/error.middleware');
const { authenticateJwt } = require('./middleware/auth.middleware');

// Import socket handlers
const { setupSocketHandlers } = require('./services/socket.service');

// Import database connection
const { connectToDatabase } = require('./config/database');

// Import passport config (ensures strategies are registered)
require('./config/passport');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Set up rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use('/api/', apiLimiter);

// Set up socket handlers
setupSocketHandlers(io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateJwt, userRoutes);
app.use('/api/chatrooms', authenticateJwt, chatroomRoutes);
app.use('/api/messages', authenticateJwt, messageRoutes);
app.use('/api/agents', authenticateJwt, agentRoutes);
app.use('/api/credits', authenticateJwt, creditRoutes);
app.use('/api/stripe', authenticateJwt, stripeRoutes);
app.use('/api/byok', authenticateJwt, byokRoutes);
app.use('/api/invites', authenticateJwt, inviteRoutes);

// Stripe webhook route (needs raw body)
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/stripe.controller').handleWebhook
);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Connect to database
  try {
    await connectToDatabase();
    console.log('Connected to database');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
});

module.exports = { app, server, io };
