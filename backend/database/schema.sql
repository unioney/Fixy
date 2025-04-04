-- Fixy Platform Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    profile_image_url VARCHAR(512),
    organization VARCHAR(255),
    plan VARCHAR(50) NOT NULL DEFAULT 'Trial', -- Trial, Pro, Elite, Teams
    trial_used BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    google_id VARCHAR(255) UNIQUE,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE
);

-- Chatrooms Table
CREATE TABLE chatrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- private, group
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Chatroom Participants (for tracking which users are in which chatrooms)
CREATE TABLE chatroom_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chatroom_id UUID NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(chatroom_id, user_id)
);

-- AI Models Table
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- OpenAI, Anthropic, Google
    model_id VARCHAR(255) NOT NULL, -- e.g., gpt-4o, claude-sonnet
    credit_cost INTEGER NOT NULL DEFAULT 1,
    requires_elite BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(provider, model_id)
);

-- AI Agents Table (instances of AI models in specific chatrooms)
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    model_id UUID NOT NULL REFERENCES ai_models(id),
    chatroom_id UUID NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Messages Table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chatroom_id UUID NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_ai BOOLEAN NOT NULL DEFAULT FALSE,
    credits_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CHECK (sender_id IS NOT NULL OR agent_id IS NOT NULL) -- Either a user or an agent must be the sender
);

-- Credits Table
CREATE TABLE credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    used INTEGER NOT NULL DEFAULT 0,
    limit_amount INTEGER NOT NULL,
    reset_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Credit Transactions (for tracking credit usage and top-ups)
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Positive for top-ups, negative for usage
    description VARCHAR(255) NOT NULL,
    stripe_payment_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- BYOK (Bring Your Own Key) Table
CREATE TABLE byok (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- OpenAI, Anthropic, Google
    api_key_encrypted VARCHAR(1024) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Team Invites Table
CREATE TABLE team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chatroom_id UUID NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(email, chatroom_id)
);

-- Insert default AI models
INSERT INTO ai_models (name, provider, model_id, credit_cost, requires_elite) VALUES
('GPT-4o', 'OpenAI', 'gpt-4o', 1, FALSE),
('Claude Sonnet', 'Anthropic', 'claude-3-sonnet-20240229', 1, FALSE),
('Gemini Flash', 'Google', 'gemini-flash', 1, FALSE),
('GPT-4 Turbo', 'OpenAI', 'gpt-4-turbo', 2, TRUE),
('Claude Opus', 'Anthropic', 'claude-3-opus-20240229', 3, TRUE),
('Gemini Pro', 'Google', 'gemini-pro', 2, TRUE);

-- Create indexes for performance
CREATE INDEX idx_messages_chatroom_id ON messages(chatroom_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_chatroom_participants_chatroom_id ON chatroom_participants(chatroom_id);
CREATE INDEX idx_chatroom_participants_user_id ON chatroom_participants(user_id);
CREATE INDEX idx_agents_chatroom_id ON agents(chatroom_id);
CREATE INDEX idx_credits_user_id ON credits(user_id);
CREATE INDEX idx_team_invites_email ON team_invites(email);
