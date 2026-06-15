# ========================================================
# Stage 1: Dependency builder
# ========================================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package descriptors
COPY package*.json ./

# Install only production dependencies cleanly
RUN npm ci --only=production

# ========================================================
# Stage 2: Production runner
# ========================================================
FROM node:20-alpine AS runner

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /usr/src/app

# Copy production artifacts from builder and source code
COPY package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY server.js ./

# Run container as a non-root node user for container hardening
USER node

# Expose port
EXPOSE 8080

# Run the gateway server
CMD ["node", "server.js"]
