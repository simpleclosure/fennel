# Use multi-platform build targeting amd64 for Cloud Run
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies INCLUDING TypeScript
RUN npm install && \
    npm install -g typescript && \
    npx playwright install --with-deps chromium

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Copy the app directory to dist to maintain relative paths
RUN cp -r app dist/

# Expose port
EXPOSE 8080

# Use CMD instead of ENTRYPOINT
CMD [ "node", "dist/index.js" ]