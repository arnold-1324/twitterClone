# Backend/Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Set environment variables for build process
ENV NODE_ENV=production
ENV PORT=5000

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies
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

# Expose the port
EXPOSE 5000

# Health check (requires a /health endpoint in your API)
HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["npm", "start"]
