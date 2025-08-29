FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files first for caching
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev --ignore-scripts

# Copy application code
COPY . .

# Expose backend port
EXPOSE 5000

# Healthcheck (make sure you have a /health endpoint)
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:5000/health || exit 1

# Start backend only (Redis runs in its own container)
CMD ["npm", "start"]
