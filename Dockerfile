FROM node:22-alpine AS frontend
WORKDIR /app/Frontend
COPY Frontend/package*.json ./
RUN npm ci --include=dev
COPY Frontend/ ./
RUN npm run build

FROM node:22-alpine AS app
WORKDIR /app
RUN apk add --no-cache ffmpeg redis tini python3 qpdf
COPY Backend/package*.json ./Backend/
RUN npm ci --prefix Backend --omit=dev --ignore-scripts
COPY Backend/ ./Backend/
COPY --from=frontend /app/Frontend/dist ./Frontend/dist
ENV NODE_ENV=production HOST=0.0.0.0 MEDIA_DIR=/data/media REDIS_URL=redis://127.0.0.1:6379
EXPOSE 5000
ENTRYPOINT ["/sbin/tini", "-g", "--"]
CMD ["sh", "Backend/start-railway.sh"]
