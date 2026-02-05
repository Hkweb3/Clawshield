# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy root configs
COPY package*.json ./
COPY tsconfig.json ./

# Copy packages
COPY packages ./packages

# Install dependencies
RUN npm install

# Build all packages
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy built assets and node_modules from builder
COPY --from=builder /app /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose ports for backend and frontend (if served together)
EXPOSE 3001
EXPOSE 5173

# Start the application
# Note: In production, you might serve the frontend via the backend or a separate container
CMD ["npm", "start"]
