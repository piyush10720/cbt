#!/bin/bash
# CBT Platform Backend - Secrets Configuration Script
# Run this script AFTER cloud-init completes to securely add secrets
# Usage: ./configure-secrets.sh

set -e

echo "=== CBT Platform Backend - Secrets Configuration ==="
echo ""

# Detect user
if id "opc" &>/dev/null; then
  APP_USER="opc"
else
  APP_USER="ubuntu"
fi

ENV_FILE="/opt/cbt-backend/.env"

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

echo "This script will securely configure your secrets."
echo "Your input will not be echoed to the terminal."
echo ""

# Function to read secret input
read_secret() {
  local prompt="$1"
  local var_name="$2"
  local secret_value
  
  echo -n "$prompt: "
  read -s secret_value
  echo ""
  
  if [ -z "$secret_value" ]; then
    echo "Warning: Empty value provided for $var_name"
  fi
  
  echo "$secret_value"
}

# MongoDB URI
echo "--- MongoDB Configuration ---"
echo "Choose MongoDB option:"
echo "1) MongoDB Atlas (Recommended)"
echo "2) Local MongoDB"
read -p "Enter choice (1 or 2): " mongo_choice

if [ "$mongo_choice" = "1" ]; then
  MONGODB_URI=$(read_secret "Enter MongoDB Atlas connection string" "MONGODB_URI")
else
  MONGODB_URI="mongodb://localhost:27017/cbt-platform"
  echo "Using local MongoDB: $MONGODB_URI"
fi

# JWT Secret
echo ""
echo "--- JWT Secret ---"
echo "Generating secure JWT secret..."
JWT_SECRET=$(openssl rand -base64 48)
echo "Generated JWT secret (48 bytes)"

# Cloudinary
echo ""
echo "--- Cloudinary Configuration ---"
CLOUDINARY_CLOUD_NAME=$(read_secret "Enter Cloudinary Cloud Name" "CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY=$(read_secret "Enter Cloudinary API Key" "CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET=$(read_secret "Enter Cloudinary API Secret" "CLOUDINARY_API_SECRET")

# Gemini API
echo ""
echo "--- Gemini API Configuration ---"
GEMINI_API_KEY=$(read_secret "Enter Gemini API Key" "GEMINI_API_KEY")
read -p "Enter Gemini Model (default: gemini-1.5-flash): " GEMINI_MODEL
GEMINI_MODEL=${GEMINI_MODEL:-gemini-1.5-flash}

# CORS Origin
echo ""
echo "--- CORS Configuration ---"
read -p "Enter Frontend URL (e.g., https://yourdomain.com): " FRONTEND_URL
CORS_ORIGIN=${FRONTEND_URL}

# Get instance public IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")

# Backup existing .env
if [ -f "$ENV_FILE" ]; then
  sudo cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
  echo "Backed up existing .env file"
fi

# Create new .env file with secrets
echo ""
echo "Creating .env file with secrets..."

sudo tee "$ENV_FILE" > /dev/null << EOF
# Server Configuration
NODE_ENV=production
PORT=5000

# MongoDB Connection
MONGODB_URI=$MONGODB_URI

# JWT Secret (Auto-generated)
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=$CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY=$CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=$CLOUDINARY_API_SECRET

# Gemini API Configuration
GEMINI_API_KEY=$GEMINI_API_KEY
GEMINI_MODEL=$GEMINI_MODEL

# CORS Configuration
CORS_ORIGIN=$CORS_ORIGIN
FRONTEND_URL=$FRONTEND_URL

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# MongoDB Timeouts
MONGO_SERVER_SELECTION_TIMEOUT_MS=10000
MONGO_SOCKET_TIMEOUT_MS=45000

# Instance Information (Auto-detected)
INSTANCE_PUBLIC_IP=$PUBLIC_IP
CONFIGURED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

# Set proper permissions
sudo chown $APP_USER:$APP_USER "$ENV_FILE"
sudo chmod 600 "$ENV_FILE"

echo ""
echo "✓ Secrets configured successfully!"
echo "✓ .env file created at: $ENV_FILE"
echo "✓ File permissions set to 600 (owner read/write only)"
echo ""
echo "Configuration Summary:"
echo "  - MongoDB: ${mongo_choice:-1}"
echo "  - JWT Secret: Auto-generated (48 bytes)"
echo "  - Cloudinary: Configured"
echo "  - Gemini API: Configured"
echo "  - Frontend URL: $FRONTEND_URL"
echo "  - Instance IP: $PUBLIC_IP"
echo ""
echo "Next steps:"
echo "1. Deploy the application: sudo /opt/cbt-backend/deploy.sh"
echo "2. Check status: /opt/cbt-backend/monitor.sh"
echo ""
echo "IMPORTANT: Keep your secrets safe!"
echo "  - .env file is protected (600 permissions)"
echo "  - Backup stored at: ${ENV_FILE}.backup.*"
echo "  - Never commit .env to version control"
