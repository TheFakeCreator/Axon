# ==============================================
# Multi-stage Dockerfile for Axon API
# ==============================================

# Stage 1: Build Stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/middleware/package.json ./packages/middleware/
COPY packages/context-engine/package.json ./packages/context-engine/
COPY packages/prompt-analyzer/package.json ./packages/prompt-analyzer/
COPY packages/llm-gateway/package.json ./packages/llm-gateway/
COPY packages/quality-gate/package.json ./packages/quality-gate/
COPY packages/workspace-manager/package.json ./packages/workspace-manager/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages ./packages
COPY apps ./apps
COPY tsconfig.base.json ./

# Build all packages
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# ==============================================
# Stage 2: Production Stage
# ==============================================
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create app user
RUN addgroup -g 1001 -S axon && \
    adduser -S axon -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=axon:axon /app/node_modules ./node_modules
COPY --from=builder --chown=axon:axon /app/packages ./packages
COPY --from=builder --chown=axon:axon /app/apps ./apps
COPY --from=builder --chown=axon:axon /app/package.json ./
COPY --from=builder --chown=axon:axon /app/pnpm-workspace.yaml ./

# Create logs directory
RUN mkdir -p /app/logs && chown -R axon:axon /app/logs

# Switch to non-root user
USER axon

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/api/dist/server.js"]
