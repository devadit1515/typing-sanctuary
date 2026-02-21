FROM node:20-alpine

# Install wget for downloading FerretDB binary
RUN apk add --no-cache wget

# Download FerretDB v1.x (uses standard PostgreSQL — compatible with Neon free tier)
RUN wget -O /usr/local/bin/ferretdb \
    "https://github.com/FerretDB/FerretDB/releases/download/v1.24.0/ferretdb-linux-amd64" \
    && chmod +x /usr/local/bin/ferretdb

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app files
COPY . .

# Copy and prepare startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000
CMD ["/start.sh"]
