# ── Stage 1: Build the Frontend ───────────────────────────
FROM node:18-alpine AS frontend-builder
WORKDIR /app/Frontend

# Copy only the Frontend’s package files, install & build
COPY Frontend/package*.json ./
RUN npm ci
COPY Frontend/ ./
RUN npm run build

# ── Stage 2: Install Backend & Assemble the final image ──
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy & install only production deps, but ignore postinstall hooks
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Bring in your backend code
COPY Backend/ ./Backend/

# Pull in the static build from stage 1
COPY --from=frontend-builder /app/Frontend/build ./Frontend/build

# Expose and run
EXPOSE 5000
CMD ["node", "Backend/server.js"]
