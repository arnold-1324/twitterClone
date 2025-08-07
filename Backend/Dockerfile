# Backend/Dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files from Backend directory
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev --ignore-scripts

# Copy the rest of the backend application
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Expose the port
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]
