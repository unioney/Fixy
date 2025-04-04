# Fixy Platform Deployment Guide

This guide provides instructions for deploying the Fixy platform on a managed VPS service like Render or Cloudways.

## Prerequisites

- A managed VPS provider account (Render, Cloudways, DigitalOcean, etc.)
- PostgreSQL database (can be hosted on the same VPS or a managed database service)
- Domain name (optional but recommended for production)
- Stripe account for payment processing
- Google Developer account for OAuth
- API keys for AI providers (OpenAI, Anthropic, Google)
- SMTP email service credentials

## Environment Variables

Before deployment, you'll need to set up the following environment variables:

### Backend Environment Variables

```
# Server Configuration
PORT=3001
NODE_ENV=production
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com

# Database Configuration
DATABASE_URL=postgres://username:password@host:port/database

# JWT Authentication
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=24h

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Stripe Integration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
STRIPE_PRO_PRICE_ID=your_stripe_pro_price_id
STRIPE_ELITE_PRICE_ID=your_stripe_elite_price_id
STRIPE_TEAMS_PRICE_ID=your_stripe_teams_price_id
STRIPE_TRIAL_PAYMENT_PRICE_ID=your_stripe_trial_payment_price_id
STRIPE_CREDIT_10_PRICE_ID=your_stripe_credit_10_price_id
STRIPE_CREDIT_50_PRICE_ID=your_stripe_credit_50_price_id
STRIPE_CREDIT_100_PRICE_ID=your_stripe_credit_100_price_id

# AI Model APIs
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_AI_API_KEY=your_google_ai_api_key

# Email Service
EMAIL_SERVICE=your_email_service
EMAIL_USER=your_email_username
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=noreply@yourdomain.com

# Security
ENCRYPTION_KEY=your_32_byte_encryption_key_in_hex
```

### Frontend Environment Variables

```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

## Deployment Steps

### 1. Database Setup

1. Create a PostgreSQL database on your preferred provider
2. Run the database schema script to set up the tables:
   ```
   psql -U username -d database_name -f /path/to/fixy-platform/backend/database/schema.sql
   ```

### 2. Backend Deployment on Render

1. Log in to your Render account
2. Create a new Web Service
3. Connect your GitHub repository or upload the code
4. Configure the service:
   - Name: fixy-backend
   - Environment: Node
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && node src/server.js`
   - Add all environment variables from the list above
5. Set up a custom domain (optional)
6. Deploy the service

### 3. Frontend Deployment on Render

1. Log in to your Render account
2. Create a new Web Service
3. Connect your GitHub repository or upload the code
4. Configure the service:
   - Name: fixy-frontend
   - Environment: Node
   - Build Command: `cd frontend && npm install && npm run build`
   - Start Command: `cd frontend && npm start`
   - Add all frontend environment variables from the list above
5. Set up a custom domain (optional)
6. Deploy the service

### 4. Cloudways Deployment (Alternative)

1. Log in to your Cloudways account
2. Create a new application (PHP, Node.js)
3. Connect via SSH to your server
4. Clone your repository to the application directory
5. Navigate to the backend directory and run:
   ```
   npm install
   npm run build
   ```
6. Set up a process manager (PM2):
   ```
   npm install -g pm2
   pm2 start src/server.js --name fixy-backend
   pm2 save
   ```
7. Navigate to the frontend directory and run:
   ```
   npm install
   npm run build
   ```
8. Configure Nginx to serve the frontend build directory
9. Set up environment variables in the Cloudways application settings

## Setting Up Third-Party Services

### 1. Stripe Configuration

1. Create products and prices in your Stripe dashboard matching the subscription plans (Pro, Elite, Teams)
2. Create one-time payment products for credits (10, 50, 100)
3. Set up a webhook endpoint in your Stripe dashboard pointing to `https://api.yourdomain.com/api/stripe/webhook`
4. Add the webhook secret to your environment variables

### 2. Google OAuth Configuration

1. Create a new project in the Google Developer Console
2. Configure the OAuth consent screen
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs: `https://api.yourdomain.com/api/auth/google/callback`
5. Add the client ID and secret to your environment variables

### 3. Email Service Configuration

1. Set up an account with an email service provider (SendGrid, Mailgun, etc.)
2. Configure the SMTP settings in your environment variables
3. Verify your domain with the email service provider

## Post-Deployment Steps

1. Test the application by creating a new account
2. Verify that all features are working correctly:
   - Authentication (email and Google OAuth)
   - Chatroom creation and messaging
   - AI agent integration
   - Subscription management
   - Credit system
   - Team invites
3. Set up monitoring and logging
4. Configure regular database backups

## Troubleshooting

### Common Issues

1. **WebSocket Connection Errors**
   - Ensure your server is configured to support WebSocket connections
   - Check that the CORS settings are correct

2. **Database Connection Issues**
   - Verify the DATABASE_URL environment variable
   - Check that the database server allows connections from your application server

3. **Stripe Webhook Errors**
   - Verify the webhook endpoint is correctly configured
   - Check that the STRIPE_WEBHOOK_SECRET is correct

4. **AI Model API Errors**
   - Verify the API keys are correct
   - Check that the API keys have the necessary permissions

## Maintenance

1. Regularly update dependencies to patch security vulnerabilities
2. Monitor server resources and scale as needed
3. Keep an eye on API usage and costs
4. Regularly backup the database

## Support

For any issues or questions, please contact the Fixy platform development team.
