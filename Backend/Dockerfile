# Backend/Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Set environment variables for build process
ENV NODE_ENV=development
ENV PORT=5000


# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies
RUN mkdir -p /data
RUN npm install --omit=dev --ignore-scripts

# Copy application code
COPY . .

# Remove development-only files
RUN rm -rf \
    tests \
    .gitignore \
    .dockerignore \
    Dockerfile \
    jest.config.js

# Install Redis
RUN apk add --no-cache redis

# Copy Redis configuration
COPY redis.conf /etc/redis/redis.conf

# Expose the port
EXPOSE 5000

# Health check (requires a /health endpoint in your API)
HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl -f http://localhost:5000/health || exit 1

# Start Redis alongside the backend
CMD redis-server /etc/redis/redis.conf --daemonize yes && npm start
