# ── Stage 1: build frontend ─────────────────────────────────────────
FROM node:18-alpine AS frontend-builder
WORKDIR /app/Frontend

# 1) Copy only the package files and install
COPY Frontend/package*.json ./
RUN npm ci

# 2) Copy in all the frontend source & build it
COPY Frontend/ ./
RUN npm run build

# ── Stage 2: build final app image ─────────────────────────────────
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# 3) Copy root package.json & install only prod deps (ignore scripts)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# 4) Copy backend code
COPY Backend/ ./Backend/

# 5) Pull in the built frontend from stage 1
COPY --from=frontend-builder /app/Frontend/build ./Frontend/build

# 6) Expose & launch
EXPOSE 5000
CMD ["node", "Backend/server.js"]
