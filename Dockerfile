FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nodejs

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3011

CMD ["node", "src/liver/index.js"]



# FROM node:20

# WORKDIR /app

# # Copy only package files first (for caching)
# COPY package*.json ./

# # Install only production dependencies
# RUN npm ci --only=production

# # Copy rest of the app
# COPY . .

# # Set environment
# ENV NODE_ENV=production

# # Create non-root user and set permissions
# RUN addgroup --system --gid 1001 nodejs \
#  && adduser --system --uid 1001 --ingroup nodejs nodejs \
#  && chown -R nodejs:nodejs /app

# # Switch to non-root user
# USER nodejs

# # Expose app port
# EXPOSE 3011

# # Start server
# CMD ["node", "src/liver/index.js"]