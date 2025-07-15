# --- Stage 1: build Frontend ---
FROM node:18-alpine AS frontend-builder
WORKDIR /app

# Copy only what’s needed
COPY package*.json ./
COPY Frontend/package*.json Frontend/
RUN npm ci
RUN npm install --prefix Frontend
RUN npm run build --prefix Frontend

# --- Stage 2: build & bundle Backend + static Frontend ---
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install prod deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code and built frontend
COPY Backend/ ./Backend/
COPY --from=frontend-builder /app/Frontend/build ./Frontend/build

# Expose port and run
EXPOSE 5000
CMD ["node", "Backend/server.js"]
