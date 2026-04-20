#!/bin/bash

# Setup script for Social Media API on EC2
# Run this once to prepare the server for deployment

set -e

echo "Setting up Social Media API deployment environment..."

# Update system packages
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js using NVM
echo "Installing Node.js..."
if [ ! -d "$HOME/.nvm" ]; then
  # avoids running remote scripts directly
  curl -o /tmp/nvm-install.sh https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh
  bash /tmp/nvm-install.sh
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 24.0.0
  nvm use 24.0.0
else
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Install PM2 globally (optional, for process management)
echo "Installing PM2..."
npm install -g pm2

# Create application directory
echo "Creating application directory..."
sudo mkdir -p /var/www/social-media
sudo chown -R $(whoami):$(whoami) /var/www/social-media

# Create logs directory
echo "Creating logs directory..."
sudo mkdir -p /var/log
sudo touch /var/log/social-media-api.log
sudo chown $(whoami):$(whoami) /var/log/social-media-api.log

# Create systemd service directory
echo "🔧 Setting up systemd service directory..."
sudo mkdir -p /etc/systemd/system

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Merge your PR to main branch"
echo "2. GitHub Actions will automatically deploy"
echo "3. Monitor the deployment at: https://github.com/YOUR_REPO/actions"
echo "4. Check service status: sudo systemctl status social-media-api"
echo ""
