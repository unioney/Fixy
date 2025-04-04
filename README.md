# Fixy Platform

Fixy is a web-based, real-time group chat system with support for both human users and multiple AI agents in a single conversation.

## Features

- **User Authentication**: Email + password, Google OAuth
- **Plan-based Access**: Trial, Pro, Elite, Teams
- **AI Agent Integration**: GPT-4o, Claude, Gemini, and more
- **AI-to-AI Live Conversation**: Support for AI agents to communicate with each other
- **Real-time Messaging**: Human-to-AI and Human-to-Human messaging with WebSocket support
- **Group Chat Interface**: Create and manage multiple chatrooms
- **AI Credit Tracking**: Track AI usage based on replies
- **Team Collaboration**: Invite system for human teammates (Teams plan only)
- **BYOK Support**: Bring Your Own API Key for AI models
- **Payment Processing**: Stripe integration for subscriptions and one-time purchases

## Tech Stack

- **Frontend**: React with Next.js, Tailwind CSS
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Realtime**: Socket.IO (WebSocket)
- **Auth**: JWT + Google OAuth
- **Payments**: Stripe subscriptions + one-time top-ups
- **Deployment**: Managed VPS (Render or Cloudways ready)
- **App Type**: Installable PWA, fully mobile-responsive

## Project Structure

```
fixy-platform/
├── backend/                 # Backend API server
│   ├── database/            # Database schema and migrations
│   └── src/
│       ├── config/          # Configuration files
│       ├── controllers/     # Request handlers
│       ├── integrations/    # Third-party service integrations
│       ├── middleware/      # Express middleware
│       ├── models/          # Database models
│       ├── routes/          # API routes
│       ├── services/        # Business logic
│       └── utils/           # Utility functions
├── frontend/                # Next.js frontend
│   ├── public/              # Static assets
│   └── src/
│       ├── components/      # React components
│       ├── contexts/        # React context providers
│       ├── hooks/           # Custom React hooks
│       ├── pages/           # Next.js pages
│       ├── styles/          # CSS styles
│       └── utils/           # Utility functions
├── DEPLOYMENT.md            # Deployment instructions
├── Dockerfile               # Docker configuration
├── README.md                # Project documentation
└── todo.md                  # Development checklist
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- PostgreSQL (v13+)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```

4. Set up the PostgreSQL database:
   ```
   psql -U username -d database_name -f database/schema.sql
   ```

5. Start the development server:
   ```
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```

4. Start the development server:
   ```
   npm run dev
   ```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions on deploying the Fixy platform to a managed VPS.

## Third-Party Services

The Fixy platform integrates with the following third-party services:

- **Stripe**: For payment processing
- **Google OAuth**: For authentication
- **OpenAI API**: For GPT models
- **Anthropic API**: For Claude models
- **Google AI API**: For Gemini models
- **Email Service**: For notifications and invites

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

## Support

For support or inquiries, please contact the Fixy platform team.
