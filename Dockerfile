# Dockerfile for Fixy Platform

# Use Node.js LTS as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN cd backend && npm install --production
RUN cd frontend && npm install --production

# Copy application code
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm run build

# Expose ports
EXPOSE 3000 3001

# Create startup script
RUN echo '#!/bin/sh\n\
cd /app/backend && node src/server.js &\n\
cd /app/frontend && npm start\n\
wait' > /app/start.sh && chmod +x /app/start.sh

# Set environment variables
ENV NODE_ENV=production

# Start application
CMD ["/app/start.sh"]
