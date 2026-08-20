# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app

# Install backend dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy backend source and compile
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
RUN node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc

# Stage 2: Build frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app/client

COPY src/client/package.json src/client/package-lock.json ./
RUN npm ci

COPY src/client/ ./
RUN npm run build

# Stage 3: Runtime
FROM node:22-slim AS runtime
WORKDIR /app

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled backend
COPY --from=builder /app/dist/ ./dist/

# Copy built frontend into the path the server expects
COPY --from=frontend-builder /app/client/dist/ ./dist/src/client/

# Copy SQL migrations (read at runtime by MigrationRunner)
COPY src/infrastructure/database/migrations/ ./dist/src/infrastructure/database/migrations/

# Non-root user for security
RUN groupadd -r mindcare && useradd -r -g mindcare mindcare
USER mindcare

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "dist/src/server/realtime-server.js"]
